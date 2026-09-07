using UnityEngine;

namespace Sniper.Environment
{
    /// <summary>
    /// Gera o vento da fase. O vento muda devagar ao longo do tempo, entao o jogador
    /// precisa reavaliar antes de cada tiro em vez de decorar um valor fixo.
    /// </summary>
    public class WindManager : MonoBehaviour
    {
        public static WindManager Instance { get; private set; }

        [Header("Configuracao do vento")]
        [Tooltip("Velocidade minima e maxima do vento, em metros por segundo.")]
        [SerializeField] private float minSpeed = 0f;
        [SerializeField] private float maxSpeed = 8f;

        [Tooltip("Segundos para o vento ir de um valor ao proximo. Valores altos = mudanca suave.")]
        [SerializeField] private float changeInterval = 12f;

        [Tooltip("Semente do ruido. Mude para ter padroes de vento diferentes por fase.")]
        [SerializeField] private float noiseSeed = 0f;

        /// <summary>Vetor de vento atual, no plano horizontal (Y sempre zero).</summary>
        public Vector3 Wind { get; private set; }

        /// <summary>Forca do vento em m/s.</summary>
        public float Speed => Wind.magnitude;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;

            if (Mathf.Approximately(noiseSeed, 0f))
                noiseSeed = Random.Range(0f, 1000f);
        }

        private void Update()
        {
            // Perlin noise da uma variacao continua e suave, diferente de Random.Range
            // que pularia de um valor para outro a cada frame.
            float t = Time.time / Mathf.Max(0.01f, changeInterval);

            float angle = Mathf.PerlinNoise(noiseSeed, t) * 360f;
            float speed = Mathf.Lerp(minSpeed, maxSpeed, Mathf.PerlinNoise(t, noiseSeed));

            Wind = Quaternion.Euler(0f, angle, 0f) * Vector3.forward * speed;
        }

        /// <summary>
        /// Converte o vento para texto de HUD, no formato usado por atiradores reais:
        /// direcao em relacao a mira do jogador + velocidade.
        /// </summary>
        public string GetReadout(Transform aimReference)
        {
            if (aimReference == null) return $"{Speed:F1} m/s";

            // Angulo do vento em relacao a direcao que o jogador olha.
            Vector3 forward = Vector3.ProjectOnPlane(aimReference.forward, Vector3.up).normalized;
            float signedAngle = Vector3.SignedAngle(forward, Wind.normalized, Vector3.up);

            string arrow;
            if (signedAngle > 45f && signedAngle < 135f) arrow = "-->";       // vento da esquerda p/ direita
            else if (signedAngle < -45f && signedAngle > -135f) arrow = "<--"; // direita p/ esquerda
            else if (Mathf.Abs(signedAngle) <= 45f) arrow = "^";               // vindo de frente/indo p/ frente
            else arrow = "v";

            return $"{arrow} {Speed:F1} m/s";
        }
    }
}
