using System;
using UnityEngine;
using Sniper.Difficulty;
using Sniper.Environment;
using Sniper.Targets;

namespace Sniper.Ballistics
{
    /// <summary>
    /// A bala. Este e o script mais importante do jogo.
    ///
    /// Por que nao usar um Raycast simples?
    /// Um Raycast acerta instantaneamente e em linha reta. Sem tempo de voo, sem
    /// queda, sem vento -- ou seja, sem nada do que faz um jogo de sniper ser bom.
    ///
    /// Por que nao usar o Rigidbody da Unity?
    /// Um Rigidbody a 800 m/s "atravessa" paredes entre um frame e outro (tunneling).
    /// Aqui integramos a posicao na mao e fazemos um Raycast do ponto anterior ate o
    /// ponto novo, entao nenhum impacto e perdido, nao importa a velocidade.
    /// </summary>
    [DisallowMultipleComponent]
    public class BulletProjectile : MonoBehaviour
    {
        [Header("Fisica")]
        [Tooltip("Gravidade em m/s2. 9.81 e o valor da Terra.")]
        [SerializeField] private float gravity = 9.81f;

        [Tooltip("Resistencia do ar. Desacelera a bala ao longo do voo.")]
        [SerializeField] private float dragCoefficient = 0.0002f;

        [Tooltip("Quais camadas a bala pode acertar. Deixe de fora a camada do proprio jogador.")]
        [SerializeField] private LayerMask hitMask = ~0;

        [Header("Ciclo de vida")]
        [Tooltip("Segundos ate a bala se autodestruir se nao acertar nada.")]
        [SerializeField] private float maxLifetime = 12f;

        [Tooltip("Distancia maxima em metros. Alem disso a bala e removida.")]
        [SerializeField] private float maxRange = 2000f;

        [Header("Efeitos")]
        [SerializeField] private GameObject impactEffectPrefab;

        // --- Eventos: outros sistemas (killcam, HUD, missao) escutam sem acoplar codigo ---
        public event Action<BulletProjectile, RaycastHit> OnImpact;
        public event Action<BulletProjectile> OnExpired;

        /// <summary>Velocidade atual da bala, em m/s. Util para o HUD e a killcam.</summary>
        public Vector3 Velocity { get; private set; }

        /// <summary>Distancia percorrida desde o disparo, em metros.</summary>
        public float TravelledDistance { get; private set; }

        /// <summary>Dano base recebido da arma que disparou.</summary>
        public float Damage { get; private set; }

        private Vector3 previousPosition;
        private float lifetime;
        private bool isActive;
        private float effectiveGravity;
        private float effectiveWindScale;

        /// <summary>
        /// Coloca a bala em voo. Chamado pelo RifleController logo apos instanciar o prefab.
        /// </summary>
        public void Launch(Vector3 origin, Vector3 direction, float muzzleVelocity, float damage)
        {
            transform.position = origin;
            previousPosition = origin;

            DifficultyProfile profile = DifficultyManager.Profile;

            // A dificuldade so mexe em numeros. A fisica e sempre a mesma.
            float speedMultiplier = profile != null ? profile.bulletSpeedMultiplier : 1f;
            effectiveGravity = gravity * (profile != null ? profile.gravityScale : 1f);
            effectiveWindScale = profile != null ? profile.windScale : 1f;

            Velocity = direction.normalized * muzzleVelocity * speedMultiplier;
            Damage = damage;

            TravelledDistance = 0f;
            lifetime = 0f;
            isActive = true;

            transform.forward = direction.normalized;
        }

        private void FixedUpdate()
        {
            if (!isActive) return;

            float dt = Time.fixedDeltaTime;

            // --- 1. Forcas que agem sobre a bala neste passo ---
            Vector3 acceleration = Vector3.down * effectiveGravity;

            if (WindManager.Instance != null && effectiveWindScale > 0f)
                acceleration += WindManager.Instance.Wind * effectiveWindScale;

            // Arrasto: proporcional ao quadrado da velocidade, sempre contra o movimento.
            float speed = Velocity.magnitude;
            acceleration -= Velocity.normalized * (dragCoefficient * speed * speed);

            // --- 2. Integracao (metodo de Euler semi-implicito) ---
            Velocity += acceleration * dt;
            Vector3 nextPosition = transform.position + Velocity * dt;

            // --- 3. Colisao ao longo do segmento percorrido neste frame ---
            Vector3 segment = nextPosition - previousPosition;
            float segmentLength = segment.magnitude;

            if (segmentLength > 0f &&
                Physics.Raycast(previousPosition, segment / segmentLength, out RaycastHit hit,
                                segmentLength, hitMask, QueryTriggerInteraction.Ignore))
            {
                HandleImpact(hit);
                return;
            }

            // --- 4. Avanca ---
            transform.position = nextPosition;
            if (Velocity.sqrMagnitude > 0.001f)
                transform.forward = Velocity.normalized;

            TravelledDistance += segmentLength;
            previousPosition = nextPosition;

            // --- 5. Limites de vida ---
            lifetime += dt;
            if (lifetime >= maxLifetime || TravelledDistance >= maxRange)
                Expire();
        }

        private void HandleImpact(RaycastHit hit)
        {
            isActive = false;
            transform.position = hit.point;

            // Se acertou uma hitbox, aplica dano com o multiplicador da parte do corpo.
            Hitbox hitbox = hit.collider.GetComponent<Hitbox>();
            if (hitbox != null)
                hitbox.ApplyHit(Damage, Velocity, hit.point);

            if (impactEffectPrefab != null)
                Instantiate(impactEffectPrefab, hit.point, Quaternion.LookRotation(hit.normal));

            OnImpact?.Invoke(this, hit);

            // Atraso pequeno para a killcam conseguir mostrar o impacto antes do objeto sumir.
            Destroy(gameObject, 0.1f);
        }

        private void Expire()
        {
            isActive = false;
            OnExpired?.Invoke(this);
            Destroy(gameObject);
        }
    }
}
