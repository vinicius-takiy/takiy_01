using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;
using Sniper.Core;
using Sniper.Difficulty;
using Sniper.Mission;

namespace Sniper.UI
{
    /// <summary>
    /// Tela de fim de missao: pontos, estrelas, recorde, e botoes de repetir / menu.
    ///
    /// Detalhe importante: a tela NAO aparece na hora. Ela espera alguns segundos em
    /// tempo real para a killcam terminar -- o ultimo tiro da missao e justamente o
    /// que o jogador mais quer ver.
    /// </summary>
    public class MissionResultScreen : MonoBehaviour
    {
        [Header("Referencias")]
        [SerializeField] private MissionManager mission;

        [Tooltip("Painel raiz da tela de resultado. Comeca desativado.")]
        [SerializeField] private GameObject panel;

        [Tooltip("Raiz do HUD e dos botoes de jogo. E escondida quando o resultado aparece.")]
        [SerializeField] private GameObject gameplayUiRoot;

        [Header("Textos")]
        [SerializeField] private TMP_Text titleText;
        [SerializeField] private TMP_Text scoreText;
        [SerializeField] private TMP_Text recordText;

        [Header("Estrelas (3 imagens, da esquerda para a direita)")]
        [SerializeField] private Image[] starImages;
        [SerializeField] private Color starEarnedColor = new Color(1f, 0.85f, 0.2f);
        [SerializeField] private Color starMissingColor = new Color(0.25f, 0.25f, 0.25f);

        [Tooltip("Intervalo entre cada estrela acender, em segundos.")]
        [SerializeField] private float starRevealDelay = 0.35f;

        [Header("Botoes")]
        [SerializeField] private Button retryButton;
        [SerializeField] private Button menuButton;
        [SerializeField] private string menuSceneName = "MainMenu";

        [Header("Tempo")]
        [Tooltip("Segundos reais de espera antes de mostrar a tela (deixa a killcam terminar).")]
        [SerializeField] private float showDelay = 2f;

        private void Awake()
        {
            if (panel != null) panel.SetActive(false);

            if (retryButton != null) retryButton.onClick.AddListener(Retry);
            if (menuButton != null) menuButton.onClick.AddListener(GoToMenu);
        }

        private void OnEnable()
        {
            if (mission == null) return;
            mission.OnMissionCompleted += HandleCompleted;
            mission.OnMissionFailed += HandleFailed;
        }

        private void OnDisable()
        {
            if (mission == null) return;
            mission.OnMissionCompleted -= HandleCompleted;
            mission.OnMissionFailed -= HandleFailed;
        }

        private void HandleCompleted(int score, int stars)
        {
            int difficulty = DifficultyManager.Instance != null ? DifficultyManager.Instance.CurrentIndex : 0;
            bool isRecord = MissionProgress.SaveResult(SceneManager.GetActiveScene().name, difficulty, stars, score);

            StartCoroutine(ShowRoutine("Missao concluida", score, stars, isRecord));
        }

        private void HandleFailed()
        {
            StartCoroutine(ShowRoutine("Tempo esgotado", mission != null ? mission.Score : 0, 0, false));
        }

        private IEnumerator ShowRoutine(string title, int score, int stars, bool isRecord)
        {
            // Realtime: a killcam pode estar em camera lenta neste exato momento.
            yield return new WaitForSecondsRealtime(showDelay);

            if (gameplayUiRoot != null) gameplayUiRoot.SetActive(false);
            if (panel != null) panel.SetActive(true);

            if (titleText != null) titleText.text = title;
            if (scoreText != null) scoreText.text = $"{score} pts";
            if (recordText != null) recordText.text = isRecord ? "NOVO RECORDE" : string.Empty;

            // Todas apagadas, depois acendem uma a uma. Pequeno, mas e o que da
            // sensacao de recompensa em vez de so mostrar um numero.
            if (starImages != null)
            {
                foreach (Image star in starImages)
                    if (star != null) star.color = starMissingColor;

                for (int i = 0; i < stars && i < starImages.Length; i++)
                {
                    yield return new WaitForSecondsRealtime(starRevealDelay);
                    if (starImages[i] != null) starImages[i].color = starEarnedColor;
                }
            }
        }

        public void Retry()
        {
            Time.timeScale = 1f;
            SceneManager.LoadScene(SceneManager.GetActiveScene().name);
        }

        public void GoToMenu()
        {
            Time.timeScale = 1f;
            SceneManager.LoadScene(menuSceneName);
        }
    }
}
