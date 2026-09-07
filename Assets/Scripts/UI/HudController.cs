using System.Text;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Sniper.Ballistics;
using Sniper.Difficulty;
using Sniper.Environment;
using Sniper.Mission;
using Sniper.Weapons;

namespace Sniper.UI
{
    /// <summary>
    /// Desenha as informacoes na tela. O que aparece depende do perfil de dificuldade:
    /// no modo facil o jogador ve distancia, vento e ate a trajetoria prevista; no
    /// hardcore ele ve quase nada e precisa estimar tudo.
    ///
    /// Requer o pacote TextMeshPro (ja vem com a Unity: Window > TextMeshPro > Import).
    /// </summary>
    public class HudController : MonoBehaviour
    {
        [Header("Referencias de jogo")]
        [SerializeField] private RifleController rifle;
        [SerializeField] private ScopeController scope;
        [SerializeField] private MissionManager mission;
        [SerializeField] private Transform aimReference;

        [Header("Elementos de UI")]
        [SerializeField] private TMP_Text rangefinderText;
        [SerializeField] private TMP_Text windText;
        [SerializeField] private TMP_Text ammoText;
        [SerializeField] private TMP_Text timerText;
        [SerializeField] private TMP_Text objectivesText;
        [SerializeField] private TMP_Text zoomText;
        [SerializeField] private Image breathBar;

        [Header("Previsao de trajetoria (modo facil)")]
        [SerializeField] private LineRenderer trajectoryLine;
        [SerializeField] private LayerMask trajectoryBlockMask = ~0;

        private readonly StringBuilder builder = new StringBuilder();
        private float rangefinderRefreshTimer;
        private float cachedDistance = -1f;

        private void OnEnable()
        {
            if (mission != null) mission.OnObjectivesChanged += RefreshObjectives;
            if (rifle != null) rifle.OnAmmoChanged += RefreshAmmo;
        }

        private void OnDisable()
        {
            if (mission != null) mission.OnObjectivesChanged -= RefreshObjectives;
            if (rifle != null) rifle.OnAmmoChanged -= RefreshAmmo;
        }

        private void Start()
        {
            ApplyDifficultyVisibility();
            RefreshObjectives();
            RefreshAmmo();
        }

        private void Update()
        {
            UpdateRangefinder();
            UpdateWind();
            UpdateBreath();
            UpdateTimer();
            UpdateZoom();
            UpdateTrajectory();
        }

        /// <summary>Liga ou desliga elementos conforme o perfil ativo.</summary>
        private void ApplyDifficultyVisibility()
        {
            DifficultyProfile profile = DifficultyManager.Profile;
            if (profile == null) return;

            if (rangefinderText != null) rangefinderText.gameObject.SetActive(profile.showRangefinder);
            if (windText != null) windText.gameObject.SetActive(profile.showWindIndicator);
            if (trajectoryLine != null) trajectoryLine.gameObject.SetActive(profile.showTrajectoryPreview);
        }

        private void UpdateRangefinder()
        {
            if (rangefinderText == null || !rangefinderText.gameObject.activeSelf) return;
            if (rifle == null || rifle.Weapon == null) return;

            // Medir a cada frame gasta um Raycast a toa. 10 vezes por segundo basta.
            rangefinderRefreshTimer -= Time.deltaTime;
            if (rangefinderRefreshTimer > 0f) return;
            rangefinderRefreshTimer = 0.1f;

            cachedDistance = rifle.MeasureDistanceToTarget();

            if (cachedDistance < 0f)
            {
                rangefinderText.text = "--- m";
                return;
            }

            float drop = BallisticsSolver.EstimateDrop(cachedDistance, rifle.Weapon.muzzleVelocity);

            builder.Clear();
            builder.Append(Mathf.RoundToInt(cachedDistance)).Append(" m");
            if (drop > 0.05f)
                builder.Append("   queda ").Append(Mathf.RoundToInt(drop * 100f)).Append(" cm");

            rangefinderText.text = builder.ToString();
        }

        private void UpdateWind()
        {
            if (windText == null || !windText.gameObject.activeSelf || WindManager.Instance == null) return;
            windText.text = WindManager.Instance.GetReadout(aimReference);
        }

        private void UpdateBreath()
        {
            if (breathBar == null || scope == null) return;

            breathBar.fillAmount = scope.BreathNormalized;
            breathBar.color = scope.IsHoldingBreath ? Color.cyan : Color.white;
        }

        private void UpdateTimer()
        {
            if (timerText == null || mission == null) return;

            int totalSeconds = Mathf.CeilToInt(mission.TimeRemaining);
            timerText.text = $"{totalSeconds / 60:00}:{totalSeconds % 60:00}";
        }

        private void UpdateZoom()
        {
            if (zoomText == null || scope == null) return;

            zoomText.text = scope.IsScoped ? $"{scope.ZoomMagnification:F1}x" : string.Empty;
        }

        private void UpdateTrajectory()
        {
            if (trajectoryLine == null || !trajectoryLine.gameObject.activeSelf) return;
            if (rifle == null || rifle.Weapon == null || aimReference == null) return;

            var points = BallisticsSolver.PredictTrajectory(
                aimReference.position,
                aimReference.forward,
                rifle.Weapon.muzzleVelocity,
                steps: 200,
                hitMask: trajectoryBlockMask);

            trajectoryLine.positionCount = points.Count;
            trajectoryLine.SetPositions(points.ToArray());
        }

        private void RefreshAmmo()
        {
            if (ammoText == null || rifle == null || rifle.Weapon == null) return;
            ammoText.text = $"{rifle.AmmoInMagazine} / {rifle.Weapon.magazineSize}";
        }

        private void RefreshObjectives()
        {
            if (objectivesText == null || mission == null) return;

            builder.Clear();
            foreach (var objective in mission.Objectives)
            {
                builder.Append(objective.IsComplete ? "[x] " : "[ ] ")
                       .Append(objective.description)
                       .Append("  ")
                       .Append(objective.currentKills).Append('/').Append(objective.requiredKills)
                       .AppendLine();
            }

            objectivesText.text = builder.ToString();
        }
    }
}
