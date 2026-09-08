using UnityEngine;

namespace Sniper.Difficulty
{
    /// <summary>
    /// O coracao do modo hibrido.
    ///
    /// O jogo tem UM unico sistema de balistica, sempre realista. O que muda entre
    /// "Facil" e "Hardcore" sao apenas os numeros deste arquivo. Isso evita ter
    /// duas versoes do mesmo codigo (que e como projetos hibridos costumam morrer).
    ///
    /// No Unity: menu Assets > Create > Sniper > Perfil de Dificuldade.
    /// Crie tres assets: Facil, Normal, Hardcore.
    /// </summary>
    [CreateAssetMenu(fileName = "DifficultyProfile", menuName = "Sniper/Perfil de Dificuldade")]
    public class DifficultyProfile : ScriptableObject
    {
        [Header("Identificacao")]
        public string displayName = "Normal";

        [Header("Fisica da bala")]
        [Tooltip("Quanto da gravidade real e aplicada. 0 = bala anda reto (arcade), 1 = queda realista.")]
        [Range(0f, 1f)] public float gravityScale = 1f;

        [Tooltip("Quanto do vento afeta a bala. 0 = vento so decorativo, 1 = vento total.")]
        [Range(0f, 1f)] public float windScale = 1f;

        [Tooltip("Multiplica a velocidade de saida da bala. Acima de 1 reduz queda e tempo de voo.")]
        [Range(0.5f, 3f)] public float bulletSpeedMultiplier = 1f;

        [Header("Estabilidade da mira")]
        [Tooltip("Amplitude do balanco da respiracao, em graus. 0 = mira travada.")]
        [Range(0f, 3f)] public float swayAmplitude = 0.8f;

        [Tooltip("Segundos que o jogador consegue segurar a respiracao.")]
        [Range(0f, 15f)] public float holdBreathDuration = 5f;

        [Header("Assistencia (modo arcade)")]
        [Tooltip("Raio em metros do magnetismo de mira no alvo. 0 = sem assistencia.")]
        [Range(0f, 2f)] public float aimAssistRadius = 0f;

        [Tooltip("Quanto da correcao de mira e aplicada. 1 = trava total no alvo.")]
        [Range(0f, 1f)] public float aimAssistStrength = 0f;

        [Header("Informacao na tela")]
        [Tooltip("Mostra a distancia exata ate o alvo sob a mira.")]
        public bool showRangefinder = true;

        [Tooltip("Mostra direcao e forca do vento no HUD.")]
        public bool showWindIndicator = true;

        [Tooltip("Desenha uma linha prevendo a trajetoria da bala. So faz sentido no modo facil.")]
        public bool showTrajectoryPreview = false;

        [Header("Pontuacao")]
        [Tooltip("Multiplicador de pontos. Recompensa quem joga no dificil.")]
        [Range(0.5f, 5f)] public float scoreMultiplier = 1f;
    }
}
