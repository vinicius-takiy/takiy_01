using UnityEngine;

namespace Sniper.Core
{
    /// <summary>
    /// Salva o melhor resultado de cada missao, separado por dificuldade.
    /// Assim tres estrelas no Facil nao "apagam" o desafio de conseguir no Hardcore.
    ///
    /// Usa PlayerPrefs: simples e suficiente para um jogo offline. Se um dia houver
    /// login e nuvem, so este arquivo muda.
    /// </summary>
    public static class MissionProgress
    {
        private static string StarsKey(string missionId, int difficulty) => $"sniper.stars.{missionId}.{difficulty}";
        private static string ScoreKey(string missionId, int difficulty) => $"sniper.score.{missionId}.{difficulty}";

        public static int GetBestStars(string missionId, int difficulty)
        {
            return PlayerPrefs.GetInt(StarsKey(missionId, difficulty), 0);
        }

        public static int GetBestScore(string missionId, int difficulty)
        {
            return PlayerPrefs.GetInt(ScoreKey(missionId, difficulty), 0);
        }

        /// <summary>Grava o resultado se for melhor que o anterior. Devolve true se bateu recorde.</summary>
        public static bool SaveResult(string missionId, int difficulty, int stars, int score)
        {
            bool isRecord = false;

            if (stars > GetBestStars(missionId, difficulty))
            {
                PlayerPrefs.SetInt(StarsKey(missionId, difficulty), stars);
                isRecord = true;
            }

            if (score > GetBestScore(missionId, difficulty))
            {
                PlayerPrefs.SetInt(ScoreKey(missionId, difficulty), score);
                isRecord = true;
            }

            if (isRecord) PlayerPrefs.Save();
            return isRecord;
        }
    }
}
