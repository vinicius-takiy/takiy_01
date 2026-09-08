using System;
using UnityEngine;
using Sniper.Ballistics;
using Sniper.Difficulty;
using Sniper.Targets;

namespace Sniper.Weapons
{
    /// <summary>
    /// Dispara, controla municao, recuo e a assistencia de mira do modo facil.
    /// Coloque no mesmo GameObject da camera (junto do ScopeController).
    /// </summary>
    public class RifleController : MonoBehaviour
    {
        [Header("Referencias")]
        [SerializeField] private WeaponData weapon;
        [SerializeField] private ScopeController scope;

        [Tooltip("Prefab que contem o script BulletProjectile.")]
        [SerializeField] private BulletProjectile bulletPrefab;

        [Tooltip("Ponta do cano. Se vazio, a bala sai da propria camera.")]
        [SerializeField] private Transform muzzle;

        [SerializeField] private AudioSource audioSource;

        [Header("Assistencia de mira")]
        [Tooltip("Camadas onde o magnetismo procura alvos.")]
        [SerializeField] private LayerMask targetMask;

        [Tooltip("Alcance maximo da busca por alvos, em metros.")]
        [SerializeField] private float aimAssistRange = 1500f;

        // Eventos para HUD, missao e killcam.
        public event Action<BulletProjectile> OnShotFired;
        public event Action OnAmmoChanged;

        /// <summary>
        /// Recuo do disparo, em graus: X = horizontal, Y = vertical.
        ///
        /// Por que um evento e nao mexer no transform daqui? Porque quem controla a
        /// rotacao da mira e o TouchAimInput, e ele ATRIBUI a rotacao todo frame
        /// (transform.localRotation = ...). Qualquer rotacao aplicada aqui seria
        /// apagada no frame seguinte e o recuo simplesmente nao apareceria.
        /// Quem e dono da rotacao tem que ser quem aplica o recuo.
        /// </summary>
        public event Action<Vector2> OnRecoil;

        public int AmmoInMagazine { get; private set; }
        public bool IsReloading { get; private set; }
        public bool CanFire => !IsReloading && cooldownRemaining <= 0f && AmmoInMagazine > 0;
        public WeaponData Weapon => weapon;

        private float cooldownRemaining;

        private void Awake()
        {
            if (scope == null) scope = GetComponent<ScopeController>();
            AmmoInMagazine = weapon != null ? weapon.magazineSize : 5;
        }

        private void Update()
        {
            if (cooldownRemaining > 0f) cooldownRemaining -= Time.deltaTime;
        }

        // ---------------------------------------------------------------- API publica

        public void Fire()
        {
            if (!CanFire || weapon == null || bulletPrefab == null) return;

            Vector3 origin = muzzle != null ? muzzle.position : transform.position;
            Vector3 direction = ApplyAimAssist(origin, transform.forward);

            BulletProjectile bullet = Instantiate(bulletPrefab, origin, Quaternion.LookRotation(direction));
            bullet.Launch(origin, direction, weapon.muzzleVelocity, weapon.damage);

            AmmoInMagazine--;
            cooldownRemaining = weapon.boltActionTime;

            ApplyRecoil();
            PlayClip(weapon.fireSound);

            OnShotFired?.Invoke(bullet);
            OnAmmoChanged?.Invoke();

            if (AmmoInMagazine <= 0) StartCoroutine(ReloadRoutine());
        }

        public void Reload()
        {
            if (IsReloading || weapon == null || AmmoInMagazine >= weapon.magazineSize) return;
            StartCoroutine(ReloadRoutine());
        }

        /// <summary>Distancia ate o que estiver sob a mira. -1 se nao houver nada.</summary>
        public float MeasureDistanceToTarget()
        {
            Vector3 origin = muzzle != null ? muzzle.position : transform.position;

            if (Physics.Raycast(origin, transform.forward, out RaycastHit hit, aimAssistRange,
                                ~0, QueryTriggerInteraction.Ignore))
                return hit.distance;

            return -1f;
        }

        // ---------------------------------------------------------------- Interno

        /// <summary>
        /// Magnetismo de mira. So existe se o perfil de dificuldade permitir --
        /// no modo hardcore o raio e zero e esta funcao devolve a direcao original.
        ///
        /// Como funciona: um SphereCast e um Raycast "gordo". Se passar perto de uma
        /// hitbox, a direcao do tiro e puxada um pouco na direcao dela.
        /// </summary>
        private Vector3 ApplyAimAssist(Vector3 origin, Vector3 direction)
        {
            DifficultyProfile profile = DifficultyManager.Profile;
            if (profile == null || profile.aimAssistRadius <= 0f || profile.aimAssistStrength <= 0f)
                return direction;

            if (!Physics.SphereCast(origin, profile.aimAssistRadius, direction, out RaycastHit hit,
                                    aimAssistRange, targetMask, QueryTriggerInteraction.Ignore))
                return direction;

            if (hit.collider.GetComponent<Hitbox>() == null) return direction;

            Vector3 idealDirection = (hit.collider.bounds.center - origin).normalized;
            return Vector3.Slerp(direction, idealDirection, profile.aimAssistStrength).normalized;
        }

        private void ApplyRecoil()
        {
            float vertical = weapon.recoilVertical;
            float horizontal = UnityEngine.Random.Range(-weapon.recoilHorizontal, weapon.recoilHorizontal);

            OnRecoil?.Invoke(new Vector2(horizontal, vertical));
        }

        private System.Collections.IEnumerator ReloadRoutine()
        {
            IsReloading = true;
            PlayClip(weapon.reloadSound);

            yield return new WaitForSeconds(weapon.reloadTime);

            AmmoInMagazine = weapon.magazineSize;
            IsReloading = false;
            OnAmmoChanged?.Invoke();
        }

        private void PlayClip(AudioClip clip)
        {
            if (audioSource != null && clip != null) audioSource.PlayOneShot(clip);
        }
    }
}
