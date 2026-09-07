using UnityEngine;
using UnityEngine.AI;

namespace Sniper.Targets
{
    /// <summary>
    /// IA minima do inimigo: anda entre pontos, para de vez em quando, e entra em
    /// alerta quando ouve um tiro perto.
    ///
    /// Nao e uma IA de combate -- num jogo de sniper o inimigo nunca chega perto de
    /// voce. O objetivo aqui e criar movimento imprevisivel, para o jogador ter que
    /// calcular o adiantamento do tiro (lead).
    ///
    /// Requer um NavMesh assado na cena: Window > AI > Navigation > Bake.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public class TargetPatrol : MonoBehaviour
    {
        public enum State { Patrolling, Waiting, Alerted }

        [Header("Rota")]
        [Tooltip("Pontos da patrulha, na ordem. Crie GameObjects vazios na cena.")]
        [SerializeField] private Transform[] waypoints;

        [Tooltip("Se true, percorre os pontos em ordem aleatoria.")]
        [SerializeField] private bool randomOrder = false;

        [Header("Comportamento")]
        [Tooltip("Segundos parado em cada ponto. Pausas tornam o alvo mais facil.")]
        [SerializeField] private Vector2 waitTimeRange = new Vector2(1f, 4f);

        [SerializeField] private float patrolSpeed = 1.4f;
        [SerializeField] private float alertedSpeed = 4f;

        [Header("Alerta")]
        [Tooltip("Distancia em metros na qual o inimigo percebe um tiro que errou.")]
        [SerializeField] private float alertRadius = 12f;

        [Tooltip("Segundos correndo em panico apos ser alertado.")]
        [SerializeField] private float alertDuration = 8f;

        [Tooltip("Ponto de fuga. Se vazio, corre para o waypoint mais distante.")]
        [SerializeField] private Transform coverPoint;

        public State CurrentState { get; private set; } = State.Patrolling;

        private NavMeshAgent agent;
        private Target target;
        private int currentIndex;
        private float timer;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            target = GetComponent<Target>();
            agent.speed = patrolSpeed;
        }

        private void Start()
        {
            if (waypoints != null && waypoints.Length > 0) GoToNextWaypoint();
        }

        private void Update()
        {
            if (target != null && !target.IsAlive)
            {
                if (agent.enabled) agent.enabled = false;   // solta o controle para o ragdoll
                return;
            }

            switch (CurrentState)
            {
                case State.Patrolling:
                    if (!agent.pathPending && agent.remainingDistance <= agent.stoppingDistance + 0.1f)
                    {
                        CurrentState = State.Waiting;
                        timer = Random.Range(waitTimeRange.x, waitTimeRange.y);
                    }
                    break;

                case State.Waiting:
                    timer -= Time.deltaTime;
                    if (timer <= 0f) GoToNextWaypoint();
                    break;

                case State.Alerted:
                    timer -= Time.deltaTime;
                    if (timer <= 0f)
                    {
                        agent.speed = patrolSpeed;
                        GoToNextWaypoint();
                    }
                    break;
            }
        }

        /// <summary>
        /// Chamado quando uma bala acerta perto deste inimigo (tiro errado).
        /// Conecte ao evento OnImpact da bala, ou chame direto de um gerenciador.
        /// </summary>
        public void OnNearbyGunshot(Vector3 impactPoint)
        {
            if (target != null && !target.IsAlive) return;
            if (Vector3.Distance(transform.position, impactPoint) > alertRadius) return;

            Alert();
        }

        public void Alert()
        {
            CurrentState = State.Alerted;
            timer = alertDuration;
            agent.speed = alertedSpeed;

            Vector3 destination = coverPoint != null ? coverPoint.position : FindFarthestWaypoint();
            if (agent.enabled) agent.SetDestination(destination);
        }

        private void GoToNextWaypoint()
        {
            if (waypoints == null || waypoints.Length == 0) return;

            currentIndex = randomOrder
                ? Random.Range(0, waypoints.Length)
                : (currentIndex + 1) % waypoints.Length;

            CurrentState = State.Patrolling;

            if (agent.enabled && waypoints[currentIndex] != null)
                agent.SetDestination(waypoints[currentIndex].position);
        }

        private Vector3 FindFarthestWaypoint()
        {
            if (waypoints == null || waypoints.Length == 0) return transform.position;

            Vector3 best = transform.position;
            float bestDistance = -1f;

            foreach (Transform point in waypoints)
            {
                if (point == null) continue;

                float distance = (point.position - transform.position).sqrMagnitude;
                if (distance > bestDistance)
                {
                    bestDistance = distance;
                    best = point.position;
                }
            }

            return best;
        }
    }
}
