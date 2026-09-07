using UnityEngine;

namespace Sniper.Difficulty
{
    /// <summary>
    /// Guarda qual perfil de dificuldade esta ativo e sobrevive entre as cenas.
    /// Qualquer script pode ler DifficultyManager.Profile.
    /// </summary>
    public class DifficultyManager : MonoBehaviour
    {
        public static DifficultyManager Instance { get; private set; }

        [Tooltip("Arraste aqui os assets Facil / Normal / Hardcore, nessa ordem.")]
        [SerializeField] private DifficultyProfile[] profiles;

        [SerializeField] private int defaultProfileIndex = 1;

        private const string SaveKey = "sniper.difficulty";

        /// <summary>Perfil ativo. Nunca retorna null se o array estiver preenchido.</summary>
        public static DifficultyProfile Profile
        {
            get
            {
                if (Instance == null || Instance.profiles == null || Instance.profiles.Length == 0)
                {
                    Debug.LogError("DifficultyManager nao configurado. Coloque o prefab na primeira cena.");
                    return null;
                }
                return Instance.profiles[Instance.currentIndex];
            }
        }

        private int currentIndex;

        private void Awake()
        {
            // Padrao Singleton: garante uma unica instancia viva no jogo inteiro.
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            currentIndex = PlayerPrefs.GetInt(SaveKey, defaultProfileIndex);
            currentIndex = Mathf.Clamp(currentIndex, 0, Mathf.Max(0, profiles.Length - 1));
        }

        /// <summary>Chamado pelos botoes do menu de dificuldade.</summary>
        public void SetProfile(int index)
        {
            if (profiles == null || index < 0 || index >= profiles.Length) return;

            currentIndex = index;
            PlayerPrefs.SetInt(SaveKey, index);
            PlayerPrefs.Save();
        }

        public int ProfileCount => profiles != null ? profiles.Length : 0;
        public int CurrentIndex => currentIndex;
    }
}
