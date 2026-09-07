using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;
using Sniper.Core;
using Sniper.Difficulty;

namespace Sniper.UI
{
    /// <summary>
    /// Menu inicial: escolher a dificuldade e comecar a missao.
    ///
    /// Os botoes NAO precisam ser ligados um a um no Inspector -- este script
    /// registra o clique de cada um em codigo, na ordem do array. Botao 0 = perfil 0.
    /// </summary>
    public class DifficultyMenu : MonoBehaviour
    {
        [Header("Botoes de dificuldade (mesma ordem dos perfis)")]
        [SerializeField] private Button[] difficultyButtons;

        [Tooltip("Cor do botao selecionado.")]
        [SerializeField] private Color selectedColor = new Color(1f, 0.75f, 0.2f);
        [SerializeField] private Color normalColor = Color.white;

        [Header("Detalhes do perfil")]
        [SerializeField] private TMP_Text profileNameText;
        [SerializeField] private TMP_Text profileDetailsText;
        [SerializeField] private TMP_Text bestResultText;

        [Header("Missao")]
        [SerializeField] private Button playButton;

        [Tooltip("Nome exato da cena da missao. Ela precisa estar em File > Build Settings.")]
        [SerializeField] private string missionSceneName = "Mission_01";

        private void Start()
        {
            for (int i = 0; i < difficultyButtons.Length; i++)
            {
                if (difficultyButtons[i] == null) continue;

                // Copiar para uma variavel local e obrigatorio: sem isso, todos os
                // botoes usariam o valor final de "i" (classico erro de closure em C#).
                int index = i;
                difficultyButtons[i].onClick.AddListener(() => SelectDifficulty(index));
            }

            if (playButton != null) playButton.onClick.AddListener(Play);

            int current = DifficultyManager.Instance != null ? DifficultyManager.Instance.CurrentIndex : 1;
            SelectDifficulty(current);
        }

        public void SelectDifficulty(int index)
        {
            if (DifficultyManager.Instance == null) return;

            DifficultyManager.Instance.SetProfile(index);
            RefreshButtons(index);
            RefreshDetails(DifficultyManager.Instance.GetProfile(index), index);
        }

        public void Play()
        {
            // Garante que nenhum efeito de camera lenta "vazou" de uma missao anterior.
            Time.timeScale = 1f;
            SceneManager.LoadScene(missionSceneName);
        }

        private void RefreshButtons(int selected)
        {
            for (int i = 0; i < difficultyButtons.Length; i++)
            {
                if (difficultyButtons[i] == null) continue;

                Image image = difficultyButtons[i].targetGraphic as Image;
                if (image != null) image.color = i == selected ? selectedColor : normalColor;
            }
        }

        private void RefreshDetails(DifficultyProfile profile, int index)
        {
            if (profile == null) return;

            if (profileNameText != null) profileNameText.text = profile.displayName;

            if (profileDetailsText != null)
            {
                profileDetailsText.text =
                    $"Queda da bala: {Percent(profile.gravityScale)}\n" +
                    $"Vento: {Percent(profile.windScale)}\n" +
                    $"Assistencia de mira: {(profile.aimAssistRadius > 0f ? "Sim" : "Nao")}\n" +
                    $"Telemetro: {(profile.showRangefinder ? "Sim" : "Nao")}\n" +
                    $"Pontuacao: x{profile.scoreMultiplier:F1}";
            }

            if (bestResultText != null)
            {
                int stars = MissionProgress.GetBestStars(missionSceneName, index);
                int score = MissionProgress.GetBestScore(missionSceneName, index);

                bestResultText.text = stars > 0
                    ? $"Melhor: {new string('*', stars)}{new string('-', 3 - stars)}  {score} pts"
                    : "Ainda nao concluida";
            }
        }

        private static string Percent(float value) => $"{Mathf.RoundToInt(value * 100f)}%";
    }
}
