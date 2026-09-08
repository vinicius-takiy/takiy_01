using System.Collections.Generic;
using UnityEngine;
using Sniper.Difficulty;
using Sniper.Environment;

namespace Sniper.Ballistics
{
    /// <summary>
    /// Calculos de balistica que NAO envolvem uma bala real em voo.
    ///
    /// Serve para duas coisas:
    ///  - desenhar a linha de trajetoria prevista no modo facil;
    ///  - calcular a queda em centimetros para ensinar o jogador a compensar.
    ///
    /// E uma classe estatica: nao precisa existir na cena, e so chamar
    /// BallisticsSolver.PredictTrajectory(...).
    /// </summary>
    public static class BallisticsSolver
    {
        /// <summary>
        /// Simula a trajetoria com o mesmo passo de tempo da fisica e devolve os pontos.
        /// Usar o mesmo dt do BulletProjectile e essencial: se a previsao usar outro passo,
        /// a linha desenhada nao vai bater com onde a bala realmente cai.
        /// </summary>
        /// <param name="steps">Quantos passos simular. Mais passos = linha mais longa e mais custo.</param>
        public static List<Vector3> PredictTrajectory(
            Vector3 origin,
            Vector3 direction,
            float muzzleVelocity,
            int steps = 240,
            float gravity = 9.81f,
            float dragCoefficient = 0.0002f,
            LayerMask? hitMask = null)
        {
            var points = new List<Vector3>(steps + 1);

            DifficultyProfile profile = DifficultyManager.Profile;
            float speedMultiplier = profile != null ? profile.bulletSpeedMultiplier : 1f;
            float g = gravity * (profile != null ? profile.gravityScale : 1f);
            float windScale = profile != null ? profile.windScale : 1f;

            Vector3 wind = WindManager.Instance != null ? WindManager.Instance.Wind : Vector3.zero;
            Vector3 velocity = direction.normalized * muzzleVelocity * speedMultiplier;
            Vector3 position = origin;
            float dt = Time.fixedDeltaTime;

            points.Add(position);

            for (int i = 0; i < steps; i++)
            {
                Vector3 acceleration = Vector3.down * g + wind * windScale;

                float speed = velocity.magnitude;
                acceleration -= velocity.normalized * (dragCoefficient * speed * speed);

                velocity += acceleration * dt;
                Vector3 next = position + velocity * dt;

                // Para a linha no primeiro obstaculo, senao ela atravessa o cenario.
                if (hitMask.HasValue)
                {
                    Vector3 segment = next - position;
                    float length = segment.magnitude;
                    if (length > 0f && Physics.Raycast(position, segment / length, out RaycastHit hit,
                                                       length, hitMask.Value, QueryTriggerInteraction.Ignore))
                    {
                        points.Add(hit.point);
                        break;
                    }
                }

                position = next;
                points.Add(position);
            }

            return points;
        }

        /// <summary>
        /// Queda aproximada da bala, em metros, para um alvo a determinada distancia.
        /// Formula do lancamento de projetil: queda = 0.5 * g * t^2, com t = distancia / velocidade.
        /// Ignora arrasto, entao subestima um pouco em distancias muito longas -- o suficiente
        /// para o jogador aprender o conceito.
        /// </summary>
        public static float EstimateDrop(float distanceMeters, float muzzleVelocity, float gravity = 9.81f)
        {
            DifficultyProfile profile = DifficultyManager.Profile;
            float speedMultiplier = profile != null ? profile.bulletSpeedMultiplier : 1f;
            float g = gravity * (profile != null ? profile.gravityScale : 1f);

            float effectiveVelocity = Mathf.Max(1f, muzzleVelocity * speedMultiplier);
            float timeOfFlight = distanceMeters / effectiveVelocity;

            return 0.5f * g * timeOfFlight * timeOfFlight;
        }

        /// <summary>Tempo de voo estimado ate a distancia informada, em segundos.</summary>
        public static float EstimateTimeOfFlight(float distanceMeters, float muzzleVelocity)
        {
            DifficultyProfile profile = DifficultyManager.Profile;
            float speedMultiplier = profile != null ? profile.bulletSpeedMultiplier : 1f;
            return distanceMeters / Mathf.Max(1f, muzzleVelocity * speedMultiplier);
        }
    }
}
