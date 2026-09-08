using UnityEngine;
using Sniper.Difficulty;

namespace Sniper.Weapons
{
    /// <summary>
    /// Controla a luneta: zoom, balanco da respiracao e a mecanica de prender o folego.
    ///
    /// Este script e o que faz o jogo "sentir" como um sniper. Sem o balanco, acertar
    /// um alvo a 400 metros vira apontar e clicar -- sem tensao nenhuma.
    ///
    /// Coloque este componente no mesmo GameObject da camera principal.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public class ScopeController : MonoBehaviour
    {
        [Header("Referencias")]
        [SerializeField] private WeaponData weapon;

        [Tooltip("Objeto da UI com a imagem da luneta. Fica desligado fora da mira.")]
        [SerializeField] private GameObject scopeOverlay;

        [Header("Camera")]
        [Tooltip("Campo de visao com a arma abaixada (visao normal).")]
        [SerializeField] private float hipFieldOfView = 60f;

        [Tooltip("Velocidade da transicao de zoom. Alto = instantaneo, baixo = suave.")]
        [SerializeField] private float zoomSpeed = 10f;

        [Header("Respiracao")]
        [Tooltip("Ciclos de respiracao por segundo. 0.25 = uma respiracao a cada 4s.")]
        [SerializeField] private float breathFrequency = 0.25f;

        [Tooltip("Segundos para recuperar o folego totalmente depois de solta-lo.")]
        [SerializeField] private float breathRecoveryTime = 4f;

        // --- Estado publico, lido pelo HUD e pelo RifleController ---
        public bool IsScoped { get; private set; }
        public int ZoomIndex { get; private set; }

        /// <summary>Folego restante, de 0 a 1. O HUD desenha isso como barra.</summary>
        public float BreathNormalized => holdBreathMax <= 0f ? 0f : breathRemaining / holdBreathMax;

        public bool IsHoldingBreath { get; private set; }

        /// <summary>Zoom atual em "vezes" (ex: 8x). Usado no texto do HUD.</summary>
        public float ZoomMagnification => targetFieldOfView <= 0f ? 1f : hipFieldOfView / targetFieldOfView;

        private Camera cam;
        private float targetFieldOfView;
        private float breathRemaining;
        private float holdBreathMax;
        private float noiseSeedX;
        private float noiseSeedY;

        // Rotacao extra aplicada pela respiracao. Guardada separada da rotacao do jogador
        // para nao "acumular" balanco permanentemente na mira.
        private Vector2 currentSway;

        private void Awake()
        {
            cam = GetComponent<Camera>();
            targetFieldOfView = hipFieldOfView;

            noiseSeedX = Random.Range(0f, 100f);
            noiseSeedY = Random.Range(0f, 100f);

            if (scopeOverlay != null) scopeOverlay.SetActive(false);
        }

        private void Start()
        {
            DifficultyProfile profile = DifficultyManager.Profile;
            holdBreathMax = profile != null ? profile.holdBreathDuration : 5f;
            breathRemaining = holdBreathMax;
        }

        private void Update()
        {
            UpdateBreath();
            UpdateZoom();
        }

        private void LateUpdate()
        {
            // LateUpdate: o balanco e aplicado DEPOIS que o jogador ja girou a camera,
            // senao o input do jogador sobrescreveria o efeito.
            ApplySway();
        }

        // ---------------------------------------------------------------- API publica

        /// <summary>Liga e desliga a luneta. Chamado pelo input de toque.</summary>
        public void ToggleScope()
        {
            SetScoped(!IsScoped);
        }

        public void SetScoped(bool scoped)
        {
            IsScoped = scoped;

            if (scoped)
            {
                ZoomIndex = 0;
                targetFieldOfView = GetZoomFov(ZoomIndex);
            }
            else
            {
                targetFieldOfView = hipFieldOfView;
                IsHoldingBreath = false;
            }

            if (scopeOverlay != null) scopeOverlay.SetActive(scoped);
        }

        /// <summary>Avanca para o proximo nivel de zoom, voltando ao primeiro no fim.</summary>
        public void CycleZoom()
        {
            if (!IsScoped || weapon == null || weapon.zoomFieldsOfView.Length == 0) return;

            ZoomIndex = (ZoomIndex + 1) % weapon.zoomFieldsOfView.Length;
            targetFieldOfView = GetZoomFov(ZoomIndex);
        }

        /// <summary>Zoom continuo por pinca (dois dedos). Valor de 0 (min) a 1 (max).</summary>
        public void SetZoomNormalized(float t)
        {
            if (!IsScoped || weapon == null || weapon.zoomFieldsOfView.Length == 0) return;

            float maxFov = weapon.zoomFieldsOfView[0];
            float minFov = weapon.zoomFieldsOfView[weapon.zoomFieldsOfView.Length - 1];
            targetFieldOfView = Mathf.Lerp(maxFov, minFov, Mathf.Clamp01(t));
        }

        /// <summary>Segurar o botao de respiracao chama isto com true.</summary>
        public void SetHoldingBreath(bool holding)
        {
            IsHoldingBreath = holding && IsScoped && breathRemaining > 0f;
        }

        // ---------------------------------------------------------------- Interno

        private float GetZoomFov(int index)
        {
            if (weapon == null || weapon.zoomFieldsOfView.Length == 0) return 12f;
            return weapon.zoomFieldsOfView[Mathf.Clamp(index, 0, weapon.zoomFieldsOfView.Length - 1)];
        }

        private void UpdateBreath()
        {
            if (IsHoldingBreath)
            {
                breathRemaining -= Time.deltaTime;

                // Acabou o folego: solta sozinho. Isso cria a pressao de tempo do genero.
                if (breathRemaining <= 0f)
                {
                    breathRemaining = 0f;
                    IsHoldingBreath = false;
                }
            }
            else if (breathRemaining < holdBreathMax && breathRecoveryTime > 0f)
            {
                breathRemaining += Time.deltaTime * (holdBreathMax / breathRecoveryTime);
                breathRemaining = Mathf.Min(breathRemaining, holdBreathMax);
            }
        }

        private void UpdateZoom()
        {
            cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, targetFieldOfView, Time.deltaTime * zoomSpeed);
        }

        private void ApplySway()
        {
            DifficultyProfile profile = DifficultyManager.Profile;
            float amplitude = profile != null ? profile.swayAmplitude : 0.8f;

            if (weapon != null) amplitude *= weapon.swayMultiplier;

            // Quanto mais zoom, mais o balanco aparece -- exatamente como numa luneta real.
            amplitude *= Mathf.Max(1f, ZoomMagnification * 0.15f);

            // Prender o folego reduz o balanco a quase nada, mas nao a zero:
            // zero deixaria o modo hardcore facil demais.
            if (IsHoldingBreath) amplitude *= 0.08f;

            if (!IsScoped) amplitude *= 0.3f;

            // Perlin noise em vez de seno: o balanco fica organico, nao mecanico.
            float t = Time.time * breathFrequency;
            float swayX = (Mathf.PerlinNoise(noiseSeedX, t) - 0.5f) * 2f * amplitude;
            float swayY = (Mathf.PerlinNoise(noiseSeedY, t * 1.3f) - 0.5f) * 2f * amplitude;

            Vector2 targetSway = new Vector2(swayX, swayY);
            currentSway = Vector2.Lerp(currentSway, targetSway, Time.deltaTime * 3f);

            // Rotacao local aditiva: preserva a mira do jogador e soma o balanco por cima.
            transform.localRotation *= Quaternion.Euler(currentSway.y, currentSway.x, 0f);
        }
    }
}
