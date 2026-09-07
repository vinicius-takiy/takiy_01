using UnityEngine;

namespace Sniper.Targets
{
    public enum BodyPart
    {
        Head,
        Torso,
        Limb
    }

    /// <summary>
    /// Uma regiao do corpo do alvo. Coloque um destes em cada collider do inimigo:
    /// um na cabeca, um no torso, um em cada braco e perna.
    ///
    /// E isso que faz o headshot valer a pena: o multiplicador da cabeca mata em um tiro,
    /// o do membro nao.
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class Hitbox : MonoBehaviour
    {
        [Header("Configuracao")]
        [SerializeField] private BodyPart bodyPart = BodyPart.Torso;

        [Tooltip("Multiplica o dano da bala. Cabeca ~5x, torso 1x, membro ~0.5x.")]
        [SerializeField] private float damageMultiplier = 1f;

        [Tooltip("O alvo dono desta hitbox. Se vazio, procura no objeto pai automaticamente.")]
        [SerializeField] private Target owner;

        public BodyPart Part => bodyPart;

        private void Awake()
        {
            if (owner == null) owner = GetComponentInParent<Target>();

            if (owner == null)
                Debug.LogWarning($"Hitbox em '{name}' nao encontrou um Target no objeto pai.", this);
        }

        /// <summary>Chamado pela bala no momento do impacto.</summary>
        public void ApplyHit(float baseDamage, Vector3 bulletVelocity, Vector3 hitPoint)
        {
            if (owner == null) return;
            owner.TakeDamage(baseDamage * damageMultiplier, bodyPart, bulletVelocity, hitPoint);
        }
    }
}
