using UnityEngine;

namespace Sniper.UI
{
    /// <summary>
    /// Mantem a UI fora do notch, da Dynamic Island e da barra do gesto de home.
    ///
    /// Obrigatorio no iPhone: em paisagem, o notch fica exatamente onde ficariam os
    /// botoes de luneta ou de tiro. Sem este script, o jogador toca no notch e nada
    /// acontece -- e a Apple pode rejeitar o app na revisao por isso.
    ///
    /// Como usar: crie um painel filho do Canvas chamado "SafeArea", esticado (anchors
    /// 0,0 a 1,1), coloque este componente nele e ponha TODA a UI dentro dele.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class SafeAreaFitter : MonoBehaviour
    {
        private RectTransform rectTransform;
        private Rect lastSafeArea;
        private Vector2Int lastScreenSize;

        private void Awake()
        {
            rectTransform = GetComponent<RectTransform>();
            Apply();
        }

        private void Update()
        {
            // Rotacao da tela ou troca de orientacao muda a safe area em tempo real.
            if (Screen.safeArea != lastSafeArea ||
                Screen.width != lastScreenSize.x ||
                Screen.height != lastScreenSize.y)
            {
                Apply();
            }
        }

        private void Apply()
        {
            Rect safeArea = Screen.safeArea;
            lastSafeArea = safeArea;
            lastScreenSize = new Vector2Int(Screen.width, Screen.height);

            if (Screen.width <= 0 || Screen.height <= 0) return;

            // Converte pixels para anchors (0..1). E so isso: o RectTransform faz o resto.
            Vector2 anchorMin = safeArea.position;
            Vector2 anchorMax = safeArea.position + safeArea.size;

            anchorMin.x /= Screen.width;
            anchorMin.y /= Screen.height;
            anchorMax.x /= Screen.width;
            anchorMax.y /= Screen.height;

            rectTransform.anchorMin = anchorMin;
            rectTransform.anchorMax = anchorMax;
            rectTransform.offsetMin = Vector2.zero;
            rectTransform.offsetMax = Vector2.zero;
        }
    }
}
