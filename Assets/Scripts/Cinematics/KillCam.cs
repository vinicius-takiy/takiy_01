using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Sniper.Ballistics;
using Sniper.Targets;
using Sniper.Weapons;

namespace Sniper.Cinematics
{
    /// <summary>
    /// A killcam: camera lenta seguindo a bala nos ultimos metros ate o alvo.
    ///
    /// E o que vende o genero. O truque e nao ativar a camera lenta no disparo
    /// (o jogador esperaria 2 segundos vendo nada), e sim quando a bala se aproxima
    /// de um alvo vivo. Ai o efeito comeca exatamente no momento certo.
    /// </summary>
    public class KillCam : MonoBehaviour
    {
        [Header("Referencias")]
        [Tooltip("Camera dedicada da killcam. Comeca desativada.")]
        [SerializeField] private Camera killCamera;

        [Tooltip("Rifle que dispara. A killcam se inscreve no evento de tiro dele.")]
        [SerializeField] private RifleController rifle;

        [Header("Disparo do efeito")]
        [Tooltip("A camera lenta comeca quando a bala chega a esta distancia de um alvo vivo.")]
        [SerializeField] private float triggerDistance = 25f;

        [Tooltip("Escala do tempo durante a camera lenta. 0.15 = 15% da velocidade normal.")]
        [Range(0.02f, 1f)][SerializeField] private float slowMotionScale = 0.15f;

        [Tooltip("Segundos (em tempo real) que a cena continua lenta depois do impacto.")]
        [SerializeField] private float holdAfterImpact = 1.2f;

        [Header("Enquadramento")]
        [Tooltip("Deslocamento da camera em relacao a bala: atras, acima e ao lado.")]
        [SerializeField] private Vector3 cameraOffset = new Vector3(0.6f, 0.35f, -1.8f);

        [SerializeField] private float followSmoothing = 12f;

        public bool IsPlaying { get; private set; }

        private BulletProjectile trackedBullet;
        private Target[] cachedTargets;
        private float defaultFixedDeltaTime;
        private Coroutine endRoutine;

        private void Awake()
        {
            defaultFixedDeltaTime = Time.fixedDeltaTime;
            if (killCamera != null) killCamera.gameObject.SetActive(false);
        }

        private void OnEnable()
        {
            if (rifle != null) rifle.OnShotFired += HandleShotFired;
        }

        private void OnDisable()
        {
            if (rifle != null) rifle.OnShotFired -= HandleShotFired;
            RestoreTime();
        }

        private void HandleShotFired(BulletProjectile bullet)
        {
            if (bullet == null) return;

            trackedBullet = bullet;
            cachedTargets = FindObjectsByType<Target>(FindObjectsSortMode.None);

            bullet.OnImpact += HandleImpact;
            bullet.OnExpired += HandleExpired;
        }

        private void Update()
        {
            if (trackedBullet == null) return;

            if (!IsPlaying && IsBulletNearLiveTarget())
                BeginKillCam();

            if (IsPlaying && killCamera != null)
                FollowBullet();
        }

        private bool IsBulletNearLiveTarget()
        {
            if (cachedTargets == null) return false;

            float thresholdSqr = triggerDistance * triggerDistance;
            Vector3 bulletPosition = trackedBullet.transform.position;

            foreach (Target target in cachedTargets)
            {
                if (target == null || !target.IsAlive) continue;
                if ((target.transform.position - bulletPosition).sqrMagnitude <= thresholdSqr)
                    return true;
            }

            return false;
        }

        private void BeginKillCam()
        {
            IsPlaying = true;

            if (killCamera != null)
            {
                killCamera.gameObject.SetActive(true);
                // Posiciona sem suavizacao no primeiro frame, senao a camera "voa" ate a bala.
                killCamera.transform.position = GetDesiredPosition();
                killCamera.transform.rotation = Quaternion.LookRotation(trackedBullet.transform.forward);
            }

            Time.timeScale = slowMotionScale;
            // Ajustar o fixedDeltaTime junto mantem a fisica suave em camera lenta.
            // Sem isso a bala anda aos "trancos" durante o efeito.
            Time.fixedDeltaTime = defaultFixedDeltaTime * slowMotionScale;
        }

        private void FollowBullet()
        {
            if (trackedBullet == null) return;

            // unscaledDeltaTime: a camera se move na velocidade normal mesmo com o
            // tempo do jogo lento. Com deltaTime normal ela ficaria travada.
            float t = 1f - Mathf.Exp(-followSmoothing * Time.unscaledDeltaTime);

            killCamera.transform.position =
                Vector3.Lerp(killCamera.transform.position, GetDesiredPosition(), t);

            killCamera.transform.rotation = Quaternion.Slerp(
                killCamera.transform.rotation,
                Quaternion.LookRotation(trackedBullet.transform.forward),
                t);
        }

        private Vector3 GetDesiredPosition()
        {
            Transform bullet = trackedBullet.transform;
            return bullet.position
                 + bullet.right * cameraOffset.x
                 + bullet.up * cameraOffset.y
                 + bullet.forward * cameraOffset.z;
        }

        private void HandleImpact(BulletProjectile bullet, RaycastHit hit)
        {
            Unsubscribe(bullet);

            // Alerta os inimigos proximos que ouviram o tiro errar.
            NotifyNearbyEnemies(hit.point);

            if (!IsPlaying)
            {
                trackedBullet = null;
                return;
            }

            if (endRoutine != null) StopCoroutine(endRoutine);
            endRoutine = StartCoroutine(EndAfterDelay());
        }

        private void HandleExpired(BulletProjectile bullet)
        {
            Unsubscribe(bullet);

            if (IsPlaying)
            {
                if (endRoutine != null) StopCoroutine(endRoutine);
                endRoutine = StartCoroutine(EndAfterDelay());
            }
            else
            {
                trackedBullet = null;
            }
        }

        private void NotifyNearbyEnemies(Vector3 impactPoint)
        {
            var patrols = FindObjectsByType<TargetPatrol>(FindObjectsSortMode.None);
            foreach (TargetPatrol patrol in patrols)
                patrol.OnNearbyGunshot(impactPoint);
        }

        private IEnumerator EndAfterDelay()
        {
            // WaitForSecondsRealtime ignora o timeScale -- sem isso a espera de 1.2s
            // duraria 8 segundos reais durante a camera lenta.
            yield return new WaitForSecondsRealtime(holdAfterImpact);

            RestoreTime();

            if (killCamera != null) killCamera.gameObject.SetActive(false);

            IsPlaying = false;
            trackedBullet = null;
            endRoutine = null;
        }

        private void Unsubscribe(BulletProjectile bullet)
        {
            if (bullet == null) return;
            bullet.OnImpact -= HandleImpact;
            bullet.OnExpired -= HandleExpired;
        }

        private void RestoreTime()
        {
            Time.timeScale = 1f;
            Time.fixedDeltaTime = defaultFixedDeltaTime;
        }
    }
}
