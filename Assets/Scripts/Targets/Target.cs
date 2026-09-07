using System;
using UnityEngine;

namespace Sniper.Targets
{
    /// <summary>
    /// Um inimigo. Recebe dano das hitboxes, morre e vira ragdoll.
    /// Coloque no objeto raiz do personagem (o que tem o Animator).
    /// </summary>
    public class Target : MonoBehaviour
    {
        [Header("Vida")]
        [SerializeField] private float maxHealth = 100f;

        [Header("Morte")]
        [Tooltip("Animator do personagem. E desligado na morte para o ragdoll assumir.")]
        [SerializeField] private Animator animator;

        [Tooltip("Rigidbodies do esqueleto (ragdoll). Ficam kinematic ate a morte.")]
        [SerializeField] private Rigidbody[] ragdollBodies;

        [Tooltip("Forca do empurrao da bala no corpo, para a morte ter peso visual.")]
        [SerializeField] private float impactForce = 120f;

        [Tooltip("Segundos ate o corpo sumir. 0 = fica na cena para sempre.")]
        [SerializeField] private float despawnDelay = 15f;

        // Evento estatico: a missao e a killcam escutam todas as mortes de uma vez,
        // sem precisar de referencia a cada inimigo.
        public static event Action<Target, BodyPart> OnAnyTargetKilled;

        public event Action<Target> OnKilled;

        public bool IsAlive { get; private set; } = true;
        public float Health { get; private set; }

        /// <summary>Parte do corpo do tiro fatal. Usado no calculo de pontos.</summary>
        public BodyPart KillingBlow { get; private set; }

        private void Awake()
        {
            Health = maxHealth;
            SetRagdollEnabled(false);
        }

        public void TakeDamage(float amount, BodyPart part, Vector3 bulletVelocity, Vector3 hitPoint)
        {
            if (!IsAlive) return;

            Health -= amount;
            if (Health > 0f) return;

            Health = 0f;
            IsAlive = false;
            KillingBlow = part;

            Die(bulletVelocity, hitPoint);
        }

        private void Die(Vector3 bulletVelocity, Vector3 hitPoint)
        {
            if (animator != null) animator.enabled = false;

            SetRagdollEnabled(true);

            // Empurra o corpo na direcao da bala, no ponto exato do impacto.
            Rigidbody closest = FindClosestBody(hitPoint);
            if (closest != null)
                closest.AddForceAtPosition(bulletVelocity.normalized * impactForce, hitPoint, ForceMode.Impulse);

            OnKilled?.Invoke(this);
            OnAnyTargetKilled?.Invoke(this, KillingBlow);

            if (despawnDelay > 0f) Destroy(gameObject, despawnDelay);
        }

        private void SetRagdollEnabled(bool enabled)
        {
            if (ragdollBodies == null) return;

            foreach (Rigidbody body in ragdollBodies)
            {
                if (body == null) continue;
                body.isKinematic = !enabled;
                body.detectCollisions = true;
            }
        }

        private Rigidbody FindClosestBody(Vector3 point)
        {
            if (ragdollBodies == null || ragdollBodies.Length == 0) return null;

            Rigidbody closest = null;
            float bestDistance = float.MaxValue;

            foreach (Rigidbody body in ragdollBodies)
            {
                if (body == null) continue;

                float distance = (body.worldCenterOfMass - point).sqrMagnitude;
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    closest = body;
                }
            }

            return closest;
        }
    }
}
