using UnityEngine;

namespace Sniper.Core
{
    /// <summary>
    /// Configuracoes globais do jogo. Coloque num GameObject da PRIMEIRA cena (o menu).
    ///
    /// Sem isto, no celular a Unity roda a 30fps por padrao e a tela apaga no meio
    /// de uma missao se o jogador ficar segurando a respiracao sem tocar na tela.
    /// </summary>
    public class GameBootstrap : MonoBehaviour
    {
        [SerializeField] private int targetFrameRate = 60;

        private void Awake()
        {
            Application.targetFrameRate = targetFrameRate;
            QualitySettings.vSyncCount = 0;

            // Tela nunca apaga sozinha durante o jogo.
            Screen.sleepTimeout = SleepTimeout.NeverSleep;

            // Jogo de luneta e sempre horizontal.
            Screen.orientation = ScreenOrientation.LandscapeLeft;
        }
    }
}
