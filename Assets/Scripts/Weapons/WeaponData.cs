using UnityEngine;

namespace Sniper.Weapons
{
    /// <summary>
    /// Ficha tecnica de um rifle. Como e um ScriptableObject, cada arma e um arquivo
    /// separado no projeto -- da para criar dez rifles sem escrever uma linha de codigo.
    ///
    /// No Unity: Assets > Create > Sniper > Rifle.
    /// </summary>
    [CreateAssetMenu(fileName = "NewRifle", menuName = "Sniper/Rifle")]
    public class WeaponData : ScriptableObject
    {
        [Header("Identificacao")]
        public string displayName = "Rifle Padrao";
        public Sprite icon;

        [Header("Balistica")]
        [Tooltip("Velocidade de saida da bala em m/s. Referencia real: .308 = ~850, .50 BMG = ~900.")]
        public float muzzleVelocity = 850f;

        [Tooltip("Dano base no torso. A cabeca multiplica esse valor (ver Hitbox).")]
        public float damage = 70f;

        [Header("Operacao")]
        [Tooltip("Segundos para recarregar a camara entre tiros (ferrolho).")]
        public float boltActionTime = 1.6f;

        [Tooltip("Tiros por carregador.")]
        public int magazineSize = 5;

        [Tooltip("Segundos para trocar o carregador.")]
        public float reloadTime = 3f;

        [Header("Luneta")]
        [Tooltip("Niveis de zoom em FOV (campo de visao). Menor = mais perto. Ex: 8, 4, 2.")]
        public float[] zoomFieldsOfView = { 12f, 6f, 3f };

        [Tooltip("Multiplica o balanco da respiracao. Rifles pesados balancam mais.")]
        public float swayMultiplier = 1f;

        [Header("Recuo")]
        [Tooltip("Quantos graus a mira sobe ao disparar.")]
        public float recoilVertical = 2.5f;

        [Tooltip("Variacao horizontal aleatoria do recuo, em graus.")]
        public float recoilHorizontal = 0.8f;

        [Tooltip("Velocidade com que a mira volta ao lugar depois do recuo.")]
        public float recoilRecoverySpeed = 4f;

        [Header("Audio")]
        public AudioClip fireSound;
        public AudioClip boltSound;
        public AudioClip reloadSound;
    }
}
