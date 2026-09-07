# 1. Instalar a Unity e criar o projeto

## Por que Unity e não outra ferramenta

| Opção | Veredito |
|---|---|
| **Unity 6 + URP** | Escolha certa: ecossistema dominante do gênero, roda bem em celular médio, Asset Store com rifles e cenários prontos |
| Unreal 5 | Visual superior, mas Nanite/Lumen não rodam bem em mobile; build lento demais para aprender |
| Godot 4 | Grátis e leve, mas o 3D mobile ainda é imaturo para esse tipo de jogo |
| Web / React Native | Inviável para 3D com luneta |

## Passo a passo

### 1. Instale o Unity Hub
Baixe em <https://unity.com/download>. O Hub é o gerenciador — não é o editor.

### 2. Instale a Unity 6 LTS
No Hub: **Installs → Install Editor → Unity 6 LTS**.

Módulos de build (~10 GB) — **não instale agora se ainda não tem o aparelho de teste**:
- **Android Build Support** (+ SDK & NDK Tools + OpenJDK) → quando tiver um Android
- **iOS Build Support** → só faz sentido com um Mac

Dá para adicionar depois sem reinstalar nada: **Unity Hub → Installs → ⚙ → Add Modules**.

> Nas primeiras semanas você vai testar no Editor com mouse e no celular via
> **Unity Remote** (veja [05](05-build-android.md) e [07](07-ios-iphone.md)), e nenhum
> dos dois precisa desses módulos.

### 3. Crie o projeto
No Hub: **New Project → 3D (URP) → Mobile**.

- Nome: `SniperMobile`
- URP = Universal Render Pipeline: o pipeline gráfico feito para celular.

### 4. Importe os scripts deste repositório
Copie a pasta `Assets/Scripts/` deste repositório para dentro da pasta `Assets/`
do seu projeto Unity. A Unity compila automaticamente ao voltar para o editor.

### 5. Importe o TextMeshPro
Menu **Window → TextMeshPro → Import TMP Essential Resources**.
O `HudController.cs` depende disso.

### 6. Confirme que compilou
Abra o **Console** (Window → General → Console). Se não houver erro vermelho, está tudo certo.

---

## Conceitos da Unity que você vai usar o tempo todo

| Termo | O que é |
|---|---|
| **GameObject** | Qualquer coisa na cena: câmera, inimigo, luz, ponto vazio |
| **Component** | Um comportamento colado num GameObject. Seus scripts são components |
| **MonoBehaviour** | Classe base dos scripts. Dá acesso a `Start()`, `Update()`, etc. |
| **Prefab** | Um GameObject salvo como arquivo, para instanciar várias cópias (ex: a bala) |
| **ScriptableObject** | Um arquivo só de dados, sem estar na cena (ex: `WeaponData`, `DifficultyProfile`) |
| **Inspector** | Painel onde você edita os valores `[SerializeField]` dos scripts |

## Os métodos que a Unity chama sozinha

```csharp
void Awake()       // uma vez, ao criar o objeto — configure referências aqui
void Start()       // uma vez, antes do primeiro frame
void Update()      // todo frame — input, UI, lógica geral
void FixedUpdate() // intervalo fixo (padrão 0.02s) — TUDO que é física
void LateUpdate()  // todo frame, depois do Update — câmera
```

**A regra que mais importa neste projeto:** física vai em `FixedUpdate`, nunca em
`Update`. É por isso que `BulletProjectile.cs` integra a posição da bala em
`FixedUpdate` — assim a trajetória é idêntica em qualquer celular, independente do FPS.
