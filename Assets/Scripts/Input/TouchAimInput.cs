using UnityEngine;
using Sniper.Weapons;

namespace Sniper.PlayerInput
{
    /// <summary>
    /// Controles de toque: arrastar para mirar, pinca para dar zoom, botoes para
    /// atirar / prender o folego.
    ///
    /// Detalhe que faz diferenca: a sensibilidade e dividida pelo zoom. Com 8x de
    /// aumento, o mesmo arrastar do dedo precisa mover a mira 8 vezes menos, senao
    /// e impossivel mirar em algo distante.
    ///
    /// Este script usa o Input Manager antigo (Input.touches), que funciona sem
    /// instalar nada. Se voce ja usa o novo Input System, a logica e a mesma.
    /// </summary>
    public class TouchAimInput : MonoBehaviour
    {
        [Header("Referencias")]
        [SerializeField] private Transform aimPivot;       // gira na horizontal (eixo Y)
        [SerializeField] private Transform cameraTransform; // gira na vertical (eixo X)
        [SerializeField] private ScopeController scope;
        [SerializeField] private RifleController rifle;

        [Header("Sensibilidade")]
        [SerializeField] private float lookSensitivity = 0.12f;

        [Tooltip("Suavizacao do movimento. Alto = responsivo, baixo = pesado e cinematico.")]
        [SerializeField] private float smoothing = 15f;

        [Header("Limites verticais")]
        [SerializeField] private float minPitch = -60f;
        [SerializeField] private float maxPitch = 60f;

        [Header("Zoom por pinca")]
        [SerializeField] private float pinchSensitivity = 0.005f;

        private float yaw;
        private float pitch;
        private Vector2 smoothedDelta;
        private float pinchZoom;
        private int aimFingerId = -1;

        // Recuo ainda nao "devolvido" para a mira. X = horizontal, Y = vertical.
        private Vector2 pendingRecoil;

        private void OnEnable()
        {
            if (rifle != null) rifle.OnRecoil += HandleRecoil;
        }

        private void OnDisable()
        {
            if (rifle != null) rifle.OnRecoil -= HandleRecoil;
        }

        private void Start()
        {
            if (aimPivot != null) yaw = aimPivot.eulerAngles.y;
            if (cameraTransform != null) pitch = cameraTransform.localEulerAngles.x;
        }

        private void Update()
        {
            HandlePinch();
            HandleDrag();
            RecoverRecoil();
            ApplyRotation();
        }

        // ---------------------------------------------------------------- Recuo

        /// <summary>
        /// O rifle avisa que disparou; quem move a mira somos nos.
        /// O recuo joga a mira para cima na hora e volta devagar -- e o "coice".
        /// </summary>
        private void HandleRecoil(Vector2 recoil)
        {
            pitch = Mathf.Clamp(pitch - recoil.y, minPitch, maxPitch);
            yaw += recoil.x;
            pendingRecoil += recoil;
        }

        private void RecoverRecoil()
        {
            if (pendingRecoil.sqrMagnitude < 0.0001f) return;

            float speed = rifle != null && rifle.Weapon != null ? rifle.Weapon.recoilRecoverySpeed : 4f;

            Vector2 step = pendingRecoil * (speed * Time.deltaTime);
            step = Vector2.ClampMagnitude(step, pendingRecoil.magnitude);

            pitch = Mathf.Clamp(pitch + step.y, minPitch, maxPitch);
            yaw -= step.x;
            pendingRecoil -= step;
        }

        // ---------------------------------------------------------------- Toque

        private void HandleDrag()
        {
            Vector2 delta = Vector2.zero;

            if (UnityEngine.Input.touchCount == 1)
            {
                Touch touch = UnityEngine.Input.GetTouch(0);

                if (touch.phase == TouchPhase.Began) aimFingerId = touch.fingerId;

                if (touch.fingerId == aimFingerId && touch.phase == TouchPhase.Moved)
                    delta = touch.deltaPosition;

                if (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled)
                    aimFingerId = -1;
            }
            else
            {
                aimFingerId = -1;

                // Fallback para testar no Editor com o mouse.
                if (UnityEngine.Input.GetMouseButton(0))
                    delta = new Vector2(UnityEngine.Input.GetAxis("Mouse X"), UnityEngine.Input.GetAxis("Mouse Y")) * 20f;
            }

            // A divisao pelo zoom e o que torna a mira usavel em distancias longas.
            float zoomFactor = scope != null ? Mathf.Max(1f, scope.ZoomMagnification) : 1f;
            Vector2 scaled = delta * (lookSensitivity / zoomFactor);

            smoothedDelta = Vector2.Lerp(smoothedDelta, scaled, Time.deltaTime * smoothing);

            yaw += smoothedDelta.x;
            pitch = Mathf.Clamp(pitch - smoothedDelta.y, minPitch, maxPitch);
        }

        private void HandlePinch()
        {
            if (UnityEngine.Input.touchCount < 2 || scope == null) return;

            Touch a = UnityEngine.Input.GetTouch(0);
            Touch b = UnityEngine.Input.GetTouch(1);

            Vector2 previousA = a.position - a.deltaPosition;
            Vector2 previousB = b.position - b.deltaPosition;

            float previousDistance = (previousA - previousB).magnitude;
            float currentDistance = (a.position - b.position).magnitude;

            pinchZoom = Mathf.Clamp01(pinchZoom + (currentDistance - previousDistance) * pinchSensitivity);
            scope.SetZoomNormalized(pinchZoom);
        }

        private void ApplyRotation()
        {
            if (aimPivot != null) aimPivot.rotation = Quaternion.Euler(0f, yaw, 0f);
            if (cameraTransform != null) cameraTransform.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }

        // ------------------------------------------- Ligados aos botoes da UI (Inspector)

        public void OnFireButton()
        {
            if (rifle != null) rifle.Fire();
        }

        public void OnScopeButton()
        {
            if (scope != null) scope.ToggleScope();
        }

        public void OnZoomButton()
        {
            if (scope != null) scope.CycleZoom();
        }

        public void OnReloadButton()
        {
            if (rifle != null) rifle.Reload();
        }

        /// <summary>Ligue no EventTrigger do botao: PointerDown = true, PointerUp = false.</summary>
        public void OnHoldBreathButton(bool holding)
        {
            if (scope != null) scope.SetHoldingBreath(holding);
        }
    }
}
