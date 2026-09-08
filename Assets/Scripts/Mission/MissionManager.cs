using System;
using System.Collections.Generic;
using UnityEngine;
using Sniper.Difficulty;
using Sniper.Targets;

namespace Sniper.Mission
{
    /// <summary>
    /// Controla uma fase: objetivos, tempo, pontuacao e as estrelas do fim.
    ///
    /// Uma fase deste jogo NAO e um mundo aberto. E uma cena estatica com alvos e uma
    /// lista de objetivos. Isso mantem o escopo viavel e o desempenho no celular alto.
    /// </summary>
    public class MissionManager : MonoBehaviour
    {
        [Serializable]
        public class Objective
        {
            [Tooltip("Texto mostrado no HUD.")]
            public string description = "Elimine todos os alvos";

            [Tooltip("Quantos alvos precisam ser eliminados.")]
            public int requiredKills = 1;

            [Tooltip("Se marcado, so conta se o tiro fatal for na cabeca.")]
            public bool headshotOnly = false;

            [HideInInspector] public int currentKills;

            public bool IsComplete => currentKills >= requiredKills;
        }

        [Header("Objetivos")]
        [SerializeField] private List<Objective> objectives = new List<Objective>();

        [Header("Tempo")]
        [Tooltip("Limite em segundos. 0 = sem limite.")]
        [SerializeField] private float timeLimit = 180f;

        [Header("Pontuacao")]
        [SerializeField] private int pointsPerKill = 100;
        [SerializeField] private int headshotBonus = 150;

        [Tooltip("Pontos ganhos por segundo restante no fim.")]
        [SerializeField] private int pointsPerSecondRemaining = 5;

        [Tooltip("Pontos minimos para 1, 2 e 3 estrelas.")]
        [SerializeField] private int[] starThresholds = { 300, 600, 1000 };

        // Eventos para a UI reagir sem acoplamento.
        public event Action OnObjectivesChanged;
        public event Action<int, int> OnMissionCompleted;   // (pontos, estrelas)
        public event Action OnMissionFailed;

        public IReadOnlyList<Objective> Objectives => objectives;
        public float TimeRemaining { get; private set; }
        public int Score { get; private set; }
        public bool IsRunning { get; private set; }

        private void OnEnable() => Target.OnAnyTargetKilled += HandleKill;
        private void OnDisable() => Target.OnAnyTargetKilled -= HandleKill;

        private void Start()
        {
            TimeRemaining = timeLimit;
            IsRunning = true;
        }

        private void Update()
        {
            if (!IsRunning || timeLimit <= 0f) return;

            TimeRemaining -= Time.deltaTime;

            if (TimeRemaining <= 0f)
            {
                TimeRemaining = 0f;
                Fail();
            }
        }

        private void HandleKill(Target target, BodyPart killingBlow)
        {
            if (!IsRunning) return;

            Score += pointsPerKill;
            if (killingBlow == BodyPart.Head) Score += headshotBonus;

            foreach (Objective objective in objectives)
            {
                if (objective.IsComplete) continue;
                if (objective.headshotOnly && killingBlow != BodyPart.Head) continue;

                objective.currentKills++;
            }

            OnObjectivesChanged?.Invoke();

            if (AllObjectivesComplete()) Complete();
        }

        private bool AllObjectivesComplete()
        {
            foreach (Objective objective in objectives)
                if (!objective.IsComplete) return false;

            return objectives.Count > 0;
        }

        private void Complete()
        {
            IsRunning = false;

            if (timeLimit > 0f)
                Score += Mathf.RoundToInt(TimeRemaining) * pointsPerSecondRemaining;

            // O modo hardcore vale mais pontos. E o que faz alguem escolher jogar dificil.
            DifficultyProfile profile = DifficultyManager.Profile;
            if (profile != null) Score = Mathf.RoundToInt(Score * profile.scoreMultiplier);

            OnMissionCompleted?.Invoke(Score, CalculateStars(Score));
        }

        private void Fail()
        {
            IsRunning = false;
            OnMissionFailed?.Invoke();
        }

        private int CalculateStars(int score)
        {
            int stars = 0;
            foreach (int threshold in starThresholds)
                if (score >= threshold) stars++;

            return stars;
        }
    }
}
