# Idle Chess RPG — Game Design Document

**Working Title:** Idle Chess RPG  
**Version:** 0.2.1 (implementation)  
**Genre:** Idle / Incremental / Clicker / Strategy  
**Platform:** Web / Mobile (TBD)  
**Session Target:** 5–30 min active; 24h passive catch-up viable  

---

## Design Pillars

| Pillar | Intent |
|--------|--------|
| **Chess Familiarity** | Standard board, legal moves; complexity comes from HP/combat, not rule confusion |
| **Dual Loop** | Active play = burst income; idle play = baseline income when stuck |
| **Soft Walls** | Progress slows; never fully stops — prestige and idle farm break plateaus |
| **Piece Identity** | Each piece type has a distinct combat role, not just stat tiers |
| **Meaningful Resets** | Prestige feels like "earning Elo," not punishment |

---

## 1. Core Mechanics & "Idle Chess" Ruleset

### 1.1 Combat Model: Chess Moves + RPG Stats

Standard chess is instant capture. **Idle Chess** replaces that with a **hybrid turn/combat system**:

| Concept | Definition |
|---------|------------|
| **HP (Durability)** | Each piece has HP. Captures require reducing HP to 0 (or a finishing move). |
| **Attack Power (AP)** | Damage dealt per successful attack action (move-to-attack or click). |
| **Defense (DEF)** | Flat reduction per hit: `Damage = max(1, AP - DEF)` |
| **Move = Position + Strike** | A legal chess move attacks the destination square if an enemy is there. **Line pieces** (rook/bishop/queen) striking at **range** deal damage then **stop on the square beside** the target (line slam); adjacent/melee pieces land on the target when they finish a capture. |
| **Click Damage** | Player taps enemy pieces for direct damage (`ClickDmg = BaseClick × PieceMult × ActiveMult`). Clicks do not consume initiative; **2.5s cooldown** + stamina per strike. |
| **Initiative** | Each piece acts independently when its initiative bar fills (see §1.5). |

**Capture Resolution:**

```
OnMoveAttack(attacker, target):
  raw = attacker.AP × moveTypeMult × synergyMult
  dealt = max(1, raw - target.DEF)
  target.HP -= dealt
  if target.HP <= 0:
    executeCapture(target)  // remove from board, award Gold burst
```

**Move Type Multipliers:**

| Move Type | Mult | Feel |
|-----------|------|------|
| Normal move (empty square) | 0× damage | Reposition only |
| Capture move | 1.0× | Standard strike |
| Check | 1.25× | Pressure bonus |
| Checkmate (boss finisher) | 3.0× + stage clear | Stage victory |

**Starting State:** Player field = **King only** (HP 50, AP 8, DEF 2). Enemy wave spawns opposite side with scaling composition.

---

### 1.2 Royal Decree — Solo King Start

**Problem:** A lone King can be mated, pinned, or stalemated under standard constraints — bad for Stage 1–5 onboarding.

**Rule:** When the player controls **only the King** (no other friendly pieces on board), **Royal Decree** activates automatically.

| Effect | Detail |
|--------|--------|
| **Decree Step** | King may move **1 or 2 squares** in any direction (including diagonals), ignoring standard King adjacency — still cannot move into check |
| **Royal Strike** | Any move that lands on an enemy deals **2× AP**; captures grant **2× Gold burst** |
| **Check Immunity (Solo)** | Enemy pieces cannot deliver **checkmate** while Decree is active; at most **check** (King always retains one legal escape square, algorithmically guaranteed in wave gen) |
| **Decree Stamina** | King gains **+100% click stamina regen** while solo |
| **Falloff** | Royal Decree **deactivates permanently for the current run** once a second friendly piece is deployed |

**Wave Gen Constraint (Stages 1–5):** Enemy spawns use **"Decree-Safe" layouts** — no pre-built mating nets; max 2 attackers on King at once.

**Strategic depth:**

- Players can **delay** unlocking Pawn #2 briefly to farm Decree bonuses (higher risk, higher burst Gold).
- First Pawn deploy is a **meaningful decision**: lose Decree mobility, gain DPS and initiative layering.
- King remains **high-value** late-game via aura (+5% team AP), not via solo carry.

---

### 1.3 Dynamic Pawn Promotion (In-Combat)

**Removed:** Flat "Pawn L10 → mini-Knight stat bump" milestone.  
**Added:** **Back-Rank Promotion** — army buildup across the run (strong early promotions → longer endgame).

**Trigger:** Friendly Pawn legally moves to the **enemy back rank** (rank 8 vs standard orientation).

| Phase | Behavior |
|-------|----------|
| **Promotion Choice (Active)** | Player picks: **Super-Knight**, **Super-Bishop**, **Super-Rook**, or **Super-Queen** (Queen locked until Stage 45 unlock) |
| **Promotion Choice (Auto)** | Counter-optimal score vs wave; **prefers Super-Queen** when unlocked; honors En Passant `fromForm` hint |
| **Super-Piece Duration** | Persists **across waves** until pawn/super-piece **death** or **prestige**; relocated to deploy ranks (0–1) in prep |
| **Stat Formula** | `SuperStat = PawnStat × PromotionMult[form]` + En Passant carry increments each stage clear |

**Promotion Multipliers (rest of stage only):**

| Form | AP Mult | HP Mult | Special |
|------|---------|---------|---------|
| Super-Knight | 2.5× | 2.0× | +50% vs back-rank (inherits Knight identity) |
| Super-Bishop | 2.2× | 1.8× | Pierce splash 15% |
| Super-Rook | 2.8× | 3.0× | Line slam on move |
| Super-Queen | 3.5× | 2.5× | Omni-direction; highest burst |

**Gold / Feel:**

- Promotion triggers **Promotion Fanfare** (+3× capture-burst Gold on the promoting move).
- Each successful promotion increments **Promotion Streak** (+5% stage Gold, stacks up to 5× per stage).
- Encourages **board advancement**, not passive pawn walling — idle AI weights `+4.0 × progressToBackRank`.

**Upgrade vector (Gold):** **Promotion Mastery** — reduces enemy "anti-promotion" zone (see below), +10% Super-Piece stats per level.

**Enemy counterplay (Stage 11+):** Back rank may have **Promotion Block** squares (visual: shaded rank) — Pawn must survive 1 tick on block to promote (creates tension, not hard block).

---

### 1.4 Active vs Passive Play

| Mode | Input | Income Mult | Notes |
|------|-------|-------------|-------|
| **Active** | Player moves + clicks | **1.5×–3.0×** (combo-scaled) | Combo decays after 5s idle |
| **Auto (Idle)** | AI moves pieces | **1.0×** | Runs offline at 50% efficiency |
| **Hybrid** | Auto moves + manual clicks | **1.0× moves + click layer** | Primary mid-game loop |

**Auto-play strategies (player pieces only):** Choose in the combat footer when Auto-play is ON.

| Strategy | Behavior |
|----------|----------|
| **Defensive** | Fewer risky squares; moderate king shelter; breaks stalemates with slow advance |
| **Aggressive** | Prioritizes captures and forward pressure; lower king-shelter weight |
| **Protect King** | Friendly pieces stay near the King; King avoids solo deep pushes unless capturing |

**Stalemate guard:** If all candidate moves score very low (e.g. opposite pawns, idle King), a **engagement bonus** nudges pawns forward on blocked files, diagonal alignments for future captures, and Kings toward the nearest enemy — preventing endless no-op turns. With **one enemy left**, engagement bonuses always apply so kiting knights get pressured.

**Wave forfeit (stall):** If living enemies remain after **72 combat actions** without a kill, or **4 minutes** wall-clock on normal waves, the wave **fails** (same prep penalty as King fallen — fail scaling / checkpoint). Boss waves still use the 180s boss timer.

#### 1.4.1 Manual Mode — Turn-Based Strategy (v0.2 implementation)

When **Auto-play is OFF**, combat uses a **single global initiative queue** (friendly + enemy pieces interleaved). This is turn-based, not simultaneous “all ready pieces act.”

| Rule | Behavior |
|------|----------|
| **Turn order** | Next actor = piece with earliest `nextActionAtMs` whose bar is full (`now ≥ nextActionAtMs`) |
| **Enemy turn** | AI selects and resolves one legal move immediately; piece is rescheduled |
| **Player turn** | Initiative clock **pauses**; UI assigns that piece as active; player taps a legal destination |
| **Auto mode (v0.2.1)** | Same interleaved `getNextReadyActor` queue as manual — **one** actor per combat tick |

**UI:** Sidebar **Turn order** list shows every combatant (player + enemy), initiative %, Ready/Now badges, and boss tags. Board highlights the **active** piece (sky = yours, rose = enemy acting).

**Skip turn:** If your active piece has **no legal moves**, the turn passes automatically (initiative reschedules). A **Skip Turn** button is shown if you need to confirm pass manually.

**Prep phase:** Between waves (`WAVE_PREP`), pieces can be repositioned on deploy ranks 0–1 without initiative (see §8).

**Active Multiplier Formula:**

```
ActiveMult = 1.5 + 0.1 × min(Combo, 15)   // cap 3.0× at Combo 15
Combo +1 on: legal move, capture, check, click crit
```

**Click Stamina:** 100 max; −5 per click; +10/s regen (+100% regen while Royal Decree active). Prevents pure clicker bypass of chess loop.

**Click Cooldown:** **2.5s** of **combat time** between strikes (same clock as initiative pacing via `lastSimulatedMs`; **pauses** during manual player turns so clicks cannot outrun frozen piece timers). Paced between fast pieces (~2.0s INI) and solo King (~3.0s).

**Combat focus (UI):** Player arms **Strike** or **Move** before board input — mutually exclusive. **Strike** → tap enemies for click damage (auto defaults here). **Move** → tap legal squares / captures for the active friendly piece (manual player turns default here). Captures on enemy squares use Move, not Strike.

---

### 1.5 Piece Initiative System

Each piece has **Initiative (INI)** — seconds required to fill an action bar and take one move/attack.

```
ActionInterval(piece) = BaseInterval[pieceType] / (1 + INI_level × 0.08) / GlobalSpeedMult
```

**Base intervals (INI level 0):**

| Piece | BaseInterval | Actions/min (solo) |
|-------|--------------|-------------------|
| Pawn | 2.4s | 25 |
| Knight | 2.0s | 30 |
| Bishop | 2.1s | 28.6 |
| Rook | 2.8s | 21.4 |
| Queen | 1.8s | 33.3 |
| King | 3.0s | 20 |

**Performance benefit:**

- Auto-AI runs **only for the piece whose bar just filled** — not all pieces every global tick.
- Typical frame: 1 piece decision per event, not `N_pieces × tick_rate`.
- Offline sim: advance `min(next_action_times)` clock — event-driven, not fixed polling.

**Initiative upgrade (Gold):**

```
Cost(L) = UpgradeBase(piece) × 1.16^(L-1)
Effect: −8% interval per level (cap −60% at L10 before prestige mods)
```

**Strategic depth:**

- Fast Knights probe and snipe; slow Rooks hit harder but act less — **natural role differentiation**.
- Player can **spec into speed** on one piece or spread INI upgrades.
- Boss phases that **slow all bars +20%** hurt wide armies more than elite single-piece builds — soft counter to spam.

**Turn order visualization:** Circular progress rings on board + **Turn order** sidebar (all combatants sorted by `nextActionAtMs`). Active actor marked “Now”; manual player turns show “Your move” with frozen clocks until a square is chosen.

---

### 1.6 Idle / Auto-Play AI Heuristic

**Runs when:** One piece's initiative bar reaches full.  
**Evaluates:** Legal moves for **that piece only**.

```
Score(move) =
  6.0 × isCapture
+ 4.0 × advancesTowardEnemyBackRank     // promotion pathing
+ 3.0 × givesCheck
+ 2.0 × (predictedDamage / target.MaxHP)
+ 1.5 × threatRemoved                   // captures piece that can kill us next action
+ 1.0 × centralControlBonus            // e4,d4,e5,d5 +0.5; adjacent +0.25
+ 0.8 × protectKing                     // block line to King
+ 0.5 × (pieceMobility / 8)
- 2.0 × (moveExposesKing)
- 1.5 × (moveIntoAttackedSquare unless killTradePositive)
```

**Tie-break:** prefer highest **piece value trade** (Queen > Rook > … > Pawn).

**Player auto strategies:** Defensive / Aggressive / Protect King (see §1.4). Enemy AI remains capture-first + back-rank march.

**Super-Piece override:** Promoted pawns use **form-specific weights** (e.g., Super-Rook +2.0 line capture bias).

**Offline Simulation:** Resolve event-driven actions at 50% efficiency; cap 8h effective farming per login (12h with Idle Grandmaster achievement).

---

### 1.7 Piece Base Stats (Level 1, pre-upgrades)

| Piece | Unlock Stage | Base HP | Base AP | Base DEF | INI Base | Role |
|-------|--------------|---------|---------|----------|----------|------|
| King | 0 | 50 | 8 | 2 | 3.0s | Aura: +5% team AP while alive; Royal Decree when solo |
| Pawn | 1 | 30 | 6 | 1 | 2.4s | Promotion carrier; cheap INI upgrades |
| Knight | 10 | 45 | 12 | 2 | 2.0s | Gap jump; +50% vs back-rank |
| Bishop | 15 | 40 | 11 | 1 | 2.1s | Diagonal pierce (10% splash) |
| Rook | 30 | 70 | 18 | 4 | 2.8s | Line slam — ranged hit, then occupy square beside target |
| Queen | 45 | 55 | 22 | 3 | 1.8s | Omni-direction; highest AP |

Stats scale per piece level: `Stat(L) = BaseStat × 1.12^(L-1)` (HP/AP/DEF). INI scales via dedicated upgrade track only.

---

### 1.8 Stage Structure (Micro-Loop)

```
[WAVE_PREP: shop + reposition army] → [Start Wave] → [Combat (Initiative Events)] → [Clear → auto-advance prep] → [Start Wave] …
```

**Wave phases (v0.2):** `WAVE_PREP` | `WAVE_ACTIVE` | `WAVE_COMPLETE` (legacy saves only). On clear, rewards apply and the run **immediately** enters prep for the **next** stage — no separate “Next Wave” click.

| Parameter | Early (1–10) | Mid (11–30) | Late (31–50) |
|-----------|--------------|-------------|--------------|
| Enemy HP mult | 1.0× | 1.8× | 3.2× |
| Wave size (pieces) | 2–4 | 4–7 | 6–10 |
| Stage time limit | None | 120s soft | 90s soft (overtime −10% rewards) |

**Fail State (game over):** Losing the King ends the **current wave only** — not the run.

| Trigger | Detection | Outcome |
|---------|-----------|---------|
| King HP ≤ 0 | `getKingFailReason` → `defeated` | `failWave()` |
| King removed (capture) | `getKingFailReason` → `missing` | `failWave()` |

**On fail:** Combat loop stops; `lastWaveFailReason = 'king-fallen'` and `lastKingFailDetail` (`missing` \| `defeated`) drive the prep overlay copy; fail SFX + screen shake. **Checkpoint rewind:** If `currentStage` is above the last secured milestone (`waveCheckpoints.ts` — milestones 1, 6, 10, 15, 20, 30, 45, 50, then every 10), `currentStage` resets to that checkpoint, `failCountThisStage` resets, and `enemyHpScale` resets to 1. **Same-stage retry:** If already at the checkpoint, `failCountThisStage++` and `enemyHpScale ×= 0.8` (cumulative). A milestone is secured when `maxStageReached > milestone` (cleared that wave). **Prep:** `restorePlayerKingForPrep()` places King at **e1** (file 4, rank 0) at full HP, then `healPlayerPiecesForPrep()`; enemies cleared. **Retry:** Player repositions army and presses **Start Wave** (clears fail flags). `evaluateWaveOutcome()` runs after enemy moves, pawn leaks, boss ticks, player moves (incl. boss reflect), and combat ticks.

---

## 2. Economy & Currency Loop

### 2.1 Currencies

| Currency | Symbol | Source | Spend On |
|----------|--------|--------|----------|
| **Gold** | G | Per-action combat, captures, stage clears | Piece unlocks, piece upgrades, board slots |
| **Elo Shards** | E | Prestige reset | Global meta tree |
| **Trophies** | T | Bosses, achievements | One-time unlocks (boards, AI personalities) |

---

### 2.2 Gold Income Framework

**Per-Action Passive Gold (in-combat drip):**

```
GoldAction = BaseDrip × StageGoldMult × PrestigeGoldMult × ActiveMult × (1 + 0.02 × friendlyActionsThisStage)

BaseDrip = 2 + (Stage × 0.15)
StageGoldMult = 1.14^(Stage - 1)
```

**Capture Burst:**

```
GoldCapture = BaseCaptureValue[piece] × StageGoldMult × ActiveMult

BaseCaptureValue: Pawn 5, Knight 15, Bishop 15, Rook 30, Queen 50, King (boss) 200
```

**Stage Clear Bonus:**

```
GoldClear = 50 × Stage^1.35 × (1 + 0.05 × piecesOwned)
```

**Design intent:** Exponential stage mult rewards pushing; owned-piece bonus rewards roster breadth without forcing all pieces early.

---

### 2.3 Cost Progression Formulas

**Generic exponential cost:**

```
Cost(L) = BaseCost × Growth^(L - 1)
```

| System | BaseCost | Growth | Max Level (v1) |
|--------|----------|--------|----------------|
| Piece unlock (slot) | see §3 | — | 6 pieces |
| Piece stat upgrade (AP/HP/DEF) | 100 × Tier² | 1.15 | 50 |
| **Piece Initiative** | 80 × Tier² | **1.16** | **10** |
| **Promotion Mastery** | 250 | 1.18 | 15 |
| Global board slot | 500 G | 1.25 | 8 slots |
| Click power | 200 G | 1.18 | 30 |
| Auto-AI tier | 1,000 G | 1.22 | 10 |

**Piece-specific upgrade base (scales by tier):**

```
UpgradeBase(piece) = 100 × PieceTier^2
PieceTier: Pawn 1, Knight/Bishop 2, Rook 3, Queen 4
```

**Example — Pawn AP upgrade to Level 10:**

```
Cost = 100 × 1.15^9 ≈ 352 G
```

---

### 2.4 Prestige: Elo Shards

**Reset trigger:** Manual; available from **Stage 20+**. Resets: Gold, piece levels, current stage → **Stage 1** (keeps: Elo, Trophies, achievements, boards).

**Elo earned:**

```
E = floor( sqrt(MaxStageReached × TotalGoldEarned / 1e6) × PrestigeMultBonus )
Minimum E = 1 if MaxStageReached ≥ 20
```

**Soft wall breaker:** Each prestige should yield **~1.3–1.6×** effective income for same stage depth within 2–3 runs.

---

### 2.5 Meta-Upgrade Tree

| Meta Upgrade | Effect | Cost (E) | Max |
|--------------|--------|----------|-----|
| Opening Theory | +5% Gold | 1 | 20 |
| Endgame Technique | +3% all piece AP | 2 | 15 |
| Time Control | −5% all initiative intervals | 3 | 10 |
| Tablebase Memory | Auto-AI +10% score accuracy | 2 | 10 |
| Grandmaster Instinct | +1 starting Pawn on reset | 5 | 3 |
| Board Expansion | +1 deploy slot | 8 | 2 |
| **Simultaneous Exhibitions** | **+1 parallel board (50% Gold each)** | **12** | **3** |
| **Immortal Game** | **Once per stage: revived piece at 30% HP on death** | **15** | **1** |
| **En Passant Economy** | **Promoted Super-Pieces retain 25% stats into next stage** | **10** | **5** |

#### Simultaneous Exhibitions (Multi-Board Farming)

| Rank | Unlock | Effect |
|------|--------|--------|
| 1 | 12 E | **Board B** fights Stage `max(1, current − 5)` at **50% Gold** |
| 2 | 24 E | Board B at **65% Gold** |
| 3 | 40 E | **Board C** added at **40% Gold** (same stage offset) |

- Primary board = full rewards + progression.
- Side boards use **simplified auto-only** armies (mirror unlocked roster).
- Side boards run at **0.5× initiative resolution rate** (visual optional, numbers real).

#### Immortal Game (Piece Revival)

- **Once per stage**, first friendly piece that would die instead survives at **30% HP** with 1s invulnerability.
- Triggers **Revival Flash** (+50% AP for 3 actions on that piece).
- Strong but **once/stage** — not infinite sustain.

#### En Passant Economy (Promotion Persistence)

- Each rank: **25% of Super-Piece stat bonus** stacks onto the **same pawn** after each stage clear (form stays; stats grow).
- Max 5 ranks = **125% carry** of the marginal promotion bonus per clear until pawn dies.
- **fromForm** hint restores auto-promotion preference if the pawn must re-promote mid-stage.
- Resets on prestige (meta progress kept; army promotions cleared).

---

### 2.6 Economy Loop Diagram

```
        ┌──────────────┐
        │ Combat Events│◄──── Active clicks/moves (mult)
        └──────┬───────┘
               │ Gold
               ▼
        ┌──────────────┐      ┌─────────────┐
        │ Upgrades     │─────►│ Push Stage  │
        │ Unlock Pieces│      └──────┬──────┘
        └──────────────┘             │
               ▲                     │ Wall / slow
               │                     ▼
        ┌──────────────┐      ┌─────────────┐
        │ Idle Farm    │◄─────│ Stay & Farm │
        │ (80% stage)  │      └──────┬──────┘
        └──────────────┘             │
                                       ▼
                              ┌─────────────┐
                              │ Prestige Elo│
                              └──────┬──────┘
                                     ▼
                              Global Multipliers
```

---

## 3. Progression Milestones & Bosses

### 3.1 First 50 Stages — Roadmap

| Stage Band | Theme | New Unlock | Enemy Composition | Notes |
|------------|-------|------------|-------------------|-------|
| 1–5 | **Lonely King** | Royal Decree tutorial | 1–2 Pawns | Decree-Safe waves; teach HP + capture |
| 6–9 | **First Army** | Pawn slot #2 | Pawn walls | Decree ends; initiative bars introduced |
| **10** | **Boss: En Passant Phantom** | **Knight slot** | 4 Pawns + Phantom Knight (60 HP) | Teleports every 5 actions; steals initiative |
| 11–14 | **Knights Opening** | Knight AP upgrade tree | Pawns + Knights | Active check bonus spotlight |
| **15** | **Boss: Bishop Pair** | **Bishop slot** | 2 Bishops (linked: +DEF while both alive) | Kill one weakens other |
| 16–19 | **Diagonal War** | Bishop pierce upgrade | Mixed minor | Splash damage tutorial |
| **20** | **Boss: The Castle** | **Prestige unlocked** | Rook (120 HP) + 6 Pawns | Frontal damage reduction −20% |
| 21–29 | **Midgame Grind** | Pawn #3–4, click upgrades | Full minor pieces | Soft wall; idle farm zone |
| **25** | **Promotion Milestone** | **Promotion Mastery L1 free** | Back-rank block squares | Dynamic promotion core loop |
| **30** | **Boss: Iron Rook** | **Rook slot** | Iron Rook (250 HP, DEF 8) | Promotion Block on 3 back-rank squares |
| 31–39 | **Siege** | Rook line-slam mod | Rook-heavy waves | INI spec builds matter |
| 40–44 | **Queen Hunt** | Auto-AI tier 2 | Mixed + mini-Queens (80 HP) | Prep for queen slot |
| **45** | **Boss: The Regent** | **Queen slot** | Queen + 2 Rooks | Buffs ally initiative fill +10%/10s |
| 46–49 | **Endgame Theory** | Board slot #6–7 | Full armies | Prestige loop optimal |
| **50** | **Boss: The Grandmaster** | **Tier-2 Board preview** | GM King (500 HP) + full back rank | Phase fight (see §3.2) |

---

### 3.2 Boss Stage Mechanics

**Standard Boss Rules:**

| Rule | Detail |
|------|--------|
| **Boss Piece** | Identified with crown aura; 3–10× normal HP |
| **Phase Shift** | At 66% / 33% HP: +new ability or spawn adds |
| **Timer** | 180s; optional +30s from meta upgrade |
| **Reward** | 3× GoldClear + Trophy + guaranteed unlock |

**Boss Catalog:**

| Boss | Stage | Signature Mechanic | Counterplay |
|------|-------|-------------------|-------------|
| En Passant Phantom | 10 | Teleport; −15% one random piece initiative | INI upgrades |
| Bishop Pair | 15 | Shared shield (+50% DEF) | Focus fire one bishop |
| The Castle | 20 | Frontal arc −20% damage | Flank with Knights; promotion rush |
| Iron Rook | 30 | Reflects 10% melee; Promotion Block | Bishop pierce; Promotion Mastery |
| The Regent | 45 | +10% ally AP each 10 actions | Rush boss; INI burst |
| **The Grandmaster** | **50** | **3 phases** | See below |

**The Grandmaster (Stage 50) — Phase Design:**

| Phase | HP Band | Behavior |
|-------|---------|----------|
| I — Opening | 100–66% | Summons 2 Pawns every 15 actions |
| II — Middlegame | 66–33% | Copies your highest-AP piece stat at 50% |
| III — Endgame | 33–0% | Player initiative +30% fill speed; clicks +50% damage |

**Victory condition:** Reduce GM King to 0 HP **or** deliver checkmate pattern bonus (King surrounded + check = instant phase skip).

**Tier-2 Board (post-50 teaser):** Same 8×8 with **double HP pool** — unlock full access at Prestige 2 + Trophy from GM kill.

---

### 3.3 Stage Difficulty Scaling

```
EnemyHP(stage, piece) = BaseHP[piece] × 1.08^(stage - 1) × BossMult
EnemyAP(stage) = BaseAP × 1.06^(stage - 1)
WaveCount(stage) = 2 + floor(stage / 8)
```

**Anti-wall:** If player fails stage 3×, grant **"Study Pack"**: +25% Gold for that stage only.

---

## 4. Achievement & Unlock System

### 4.1 Incremental Achievements (Gameplay Rewards)

| Achievement | Trigger | Reward |
|-------------|---------|--------|
| **Scholar's Mate** | Deliver check in ≤6 **player actions** from stage start | +10% ActiveMult on next 10 stages |
| **Promoted Prophet** | **5 promotions in one stage** | Unlock **Auto-Promote** (AI picks counter-optimal form) |
| **Idle Grandmaster** | Clear Stage 15+ with zero manual input | Offline cap 8h → 12h |
| **Exchange Artist** | Win 50 trades where your piece had lower tier value | +15% capture burst Gold permanently |
| **Tempo Tyrant** | Reach **40 combined actions/min** across army | −5% all initiative intervals (permanent) |

---

### 4.2 Milestone Reward Table

| Milestone | Reward |
|-----------|--------|
| Stage 5 | Click stamina +20 max; Royal Decree tutorial complete |
| Stage 10 | Knight slot + En Passant Phantom trophy |
| Stage 15 | Bishop slot + pierce tutorial mod |
| Stage 20 | Prestige system + 1 free Elo |
| Stage 25 | Promotion Mastery L1 free + back-rank block mechanic |
| Stage 30 | Rook slot + line-slam VFX tier |
| Stage 35 | Auto-AI personality toggle |
| Stage 40 | 6th board deploy slot |
| Stage 45 | Queen slot + Super-Queen in promotion wheel |
| Stage 50 | Tier-2 board preview + Grandmaster title (+5% Elo gain) |

**Scaling achievements (repeatable tiers):**

```
Tier N requires: TotalCaptures ≥ 100 × 2^N
Reward: +2% global Gold (stacking, cap 40%)

Tier N (promotions): TotalPromotions ≥ 10 × 2^N
Reward: +3% Super-Piece stat mult (cap 30%)
```

---

## 5. User Interface (UI) & Game Feel

### 5.1 Layout — Single Screen Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 23 │ Gold 1.24M │ Elo 12 │ [Prestige] [Achievements] │
├──────────────────────────────┬──────────────────────────────┤
│                              │  UPGRADES (tabs)             │
│      CHESSBOARD (60%)        │  ┌─────┬─────┬─────┐        │
│      - HP bars on pieces     │  │Army │Click│ Meta│        │
│      - initiative rings      │  └─────┴─────┴─────┘        │
│      - boss phase banner     │  Piece cards w/ upgrade btns │
│                              │  Cost / +AP / +HP preview    │
├──────────────────────────────┼──────────────────────────────┤
│  ACTIVE: Combo x7 │ Stamina ████░ │ Auto: ON │ Gold/sec    │
└──────────────────────────────┴──────────────────────────────┘
```

| Zone | Priority | Scannable Element |
|------|----------|-------------------|
| **Board** | Primary | HP pips, initiative rings, threat outlines (red = can kill King) |
| **Upgrade Panel** | Secondary | Next affordable upgrade highlighted green |
| **Meta Tree** | Modal / slide-over | Prestige only; node graph with Elo costs |
| **Bottom Bar** | Always visible | Auto toggle, combo, stamina, Gold/sec breakdown |
| **Multi-board tabs** | When unlocked | Primary + Exhibition B/C split income |

**Mobile:** Board top 55%; upgrades bottom sheet swipe-up.

---

### 5.2 Game Feel ("Juice") — Chess-Specific

| Event | Feedback |
|-------|----------|
| **Royal Decree move** | Gold trail on 2-square step; deeper thud SFX |
| **Pawn capture** | Small hop animation; `+5g` float text |
| **Promotion** | Rank-up flash, piece morph, "SUPER" damage numbers |
| **Knight move** | L-shaped trail ghost; metallic clop SFX |
| **Bishop pierce** | Diagonal beam; secondary damage numbers on splash |
| **Rook slam** | Screen shake (2px, 80ms); crack decal on square; slider lands beside target |
| **King fallen** | Rose prep banner; fail sting; King restored on deploy rank |
| **Queen strike** | Radial shockwave; brief chromatic aberration |
| **Check** | Board edge red pulse; heartbeat audio |
| **Initiative ready** | Subtle piece bounce; ghost arrow before auto-move |
| **Immortal Game proc** | Rewind 0.3s vignette; piece respawn shimmer |
| **Boss phase** | Camera vignette; music layer add |
| **Wave fail** | Fail SFX + shake; **King fallen** alert in wave panel |
| **Stage clear** | Board wipe blur; confetti as chess symbols |
| **Prestige** | Board folds into book; Elo counter rolls up |
| **Exhibition board clear** | Smaller confetti; distinct coin SFX |

---

### 5.3 UX Principles

- **One-thumb upgrades:** Largest button = best ROI upgrade (calculated client-side).
- **No hard dead screens:** On fail, instant prep with **King fallen** banner (captured vs defeated copy), full King restore, and 80% enemy HP; show "farm mode" suggestion at 2× time-to-kill estimate.
- **Readable automation:** Ghost arrow 0.5s before auto-move executes (player can override).
- **Royal Decree banner:** Solo King crown + "Decree Active" pulse.

---

## 6. Balancing Framework

### 6.1 Target Curves

| Metric | Target |
|--------|--------|
| Time to Stage 10 | 15–25 min first run |
| First prestige window | Stage 20–28 (~45–90 min) |
| Post-prestige Stage 10 | 8–12 min |
| Idle parity | ~40–60% of active Gold/h at same stage |
| Boss retry rate | ≤30% players need 3+ tries on milestone bosses |

### 6.2 Wall Mitigation Toolkit

| Tool | When |
|------|------|
| Study Pack (+25% Gold) | 3 fails same stage |
| Fail HP reduction (80%) | Every fail |
| Offline farm cap | Always |
| Prestige Elo | Stage 20+ |
| Simultaneous Exhibitions | Post-prestige idle |
| En Passant Economy carry | Promotion builds |
| Immortal Game | Boss safety net |
| Achievement permanent buffs | Mid/late |

### 6.3 Key Tuning Knobs (Live Ops)

| Knob | Range |
|------|-------|
| StageGoldMult base | 1.12 – 1.16 |
| Upgrade growth | 1.12 – 1.18 |
| Enemy HP growth | 1.06 – 1.10 |
| INI per-level reduction | 6% – 10% |
| ActiveMult cap | 2.5 – 3.5 |
| Super-Piece AP mult | 2.2× – 3.5× |
| Exhibition Gold share | 40% – 65% |
| Decree solo Gold mult | 1.5× – 2.5× (burst only) |
| Offline efficiency | 0.4 – 0.6 |
| Elo formula divisor | 0.8e6 – 1.2e6 |

---

## 7. MVP Scope Recommendation

| Include v0.1 | Defer v0.2+ |
|--------------|-------------|
| King + Royal Decree | Full Stage 50 roster |
| Pawn + dynamic promotion | Queen, Rook |
| Initiative system | Multi-board exhibitions |
| Stages 1–20 + 2 bosses | Full boss catalog |
| Gold + 1 prestige layer | Trophy shop |
| Basic auto-AI heuristic | AI personalities |
| Core UI + initiative rings | Full juice pass |

---

## Appendix: Quick Reference Formulas

| Name | Formula |
|------|---------|
| Upgrade cost | `Cost(L) = Base × Growth^(L-1)` |
| Piece stat | `Stat(L) = BaseStat × 1.12^(L-1)` |
| Action interval | `BaseInterval / (1 + INI_level × 0.08) / GlobalSpeedMult` |
| Stage Gold mult | `1.14^(Stage-1)` |
| Gold per action | `BaseDrip × StageGoldMult × PrestigeMult × ActiveMult` |
| Elo on prestige | `floor(sqrt(MaxStage × TotalGold / 1e6))` |
| Super-Piece stat | `PawnStat × PromotionMult[form]` |
| Auto move score | Weighted sum (capture, promotion path, check, threat, center, king safety) |

---

## 8. v0.2 Implementation Reference (code-aligned)

Features implemented in the client but not fully specified in earlier GDD sections:

| System | Summary |
|--------|---------|
| **Wave state machine** | `WAVE_PREP` / `WAVE_ACTIVE`; clear → stage++ → prep in one step |
| **Prep repositioning** | Tap friendly piece → empty square on ranks 0–1 (King rank 0 only) |
| **Piece shop** | Milestone unlocks; buy pieces + board slot upgrades in prep |
| **Endless scaling** | Enemy HP `1.08^(stage-1)`, AP `1.06^(stage-1)`; wave size cap 16; procedural mix |
| **Boss loop** | Milestone bosses (10,15,20,30,45,50) + endless every 10 after 50; identities & trophies |
| **Wave spawn safety** | Occupancy map includes player deploy squares; no enemy/boss spawn on blocked cells |
| **Pawn leak** | Enemy pawn on player back rank → unblockable King damage, pawn removed |
| **Click combat** | `clickEnemyPiece` — Strike mode only; stamina; 2.5s combat-time cooldown |
| **Combat focus** | `strike` \| `move` — mutually exclusive board input (§1.4) |
| **Line combat resolution** | `combatMovement.ts` — ranged sliders land beside target after chip/kill |
| **King fail UX** | `failWave`, prep **King fallen** banner, King restore, 80% enemy HP per fail |
| **Prestige / meta** | Elo Shards, meta tree, Grandmaster bonus pawns on reset |
| **Exhibitions** | Background gold boards from meta rank |
| **Army buildup** | Super-promotions persist across waves; prep relocates them to ranks 0–1; death/prestige only reset |
| **En Passant Economy** | +25%/rank stat stack on stage clear; `fromForm` hints auto-promotion |
| **Immortal Game** | One revive/stage + revival flash AP buff |
| **Auto-advance waves** | Purchasable upgrade: delay in prep then optional auto-start |
| **Combat feedback** | Capture/chip/gold/leak VFX, screen shake, floating numbers |
| **Procedural audio** | Web Audio SFX + ambient/boss arpeggio; mute + volume sliders |
| **Persistence** | `localStorage` mid-wave board + phase restore |
| **Manual turn-based** | Global initiative queue; enemy auto-step, player pause (§1.4.1) |
| **Auto interleaved** | Auto-play uses same queue — no enemy kill chains (Phase 7.5) |
| **Offline progression** | `lastActiveAtMs` + 50% drip on return; 8h cap (12h Idle Grandmaster); exhibitions always |
| **King fail telegraph** | `lastKingFailAttribution` + banner cause line (capture / leak / damage) |
| **Lifetime stats** | `lifetime.*` survives prestige — drives wardrobe unlocks |
| **Cosmetics / Themes** | `cosmetics.ts` catalog; **Themes** tab; Tailwind classes on board + shell |
| **Gradual aesthetics (8.6)** | `getVisualTier` (n^1.5), board evolution (log), 12 music layers, CSS auras, prestige trophies |
| **Grandmaster boss** | Phase III +30% player initiative / +50% click; checkmate phase skip; 180s boss timer + Deep Clock +30s |
| **State / ghost JSON** | `gameSerialization.ts` full save + `combatSnapshotsEqual` round-trip test (promotions, boss runtime, mid-wave); `ghostSystem.ts` army snapshot for Arena DB |
| **Ghost AI (Arena prep)** | `combatMode: 'pvpGhost'` — protect King / shelter over pawn marching |

---

## Change Log (v0.1 → v0.2)

| Area | v0.1 | v0.2 |
|------|------|------|
| King start | Standard King | **Royal Decree** when solo |
| Promotion | L10 stat bump | **Persistent Super-Piece army** (wave-to-wave) |
| Turn system | Global 2.0s tick | **Per-piece Initiative** + **manual turn queue** |
| Meta tree | 6 nodes | **+3 high-impact nodes** |
| Sim performance | All pieces/tick | **Event-driven, single-piece AI** |
| Wave UX | Prep → fight → clear → click next | **Clear → prep** (one continue click: Start Wave) |

### v0.3.0 — Arena & Dojo (2026-06-04)

| Area | Shipped |
|------|---------|
| **PvP math** | `calculatePvPValue`, `calculateArmyPvPValue`, arena normalization |
| **Arena UI** | `ArenaLoadout.vue` — 1000 PC cap, ghost save via `exportArmySnapshotFromPieces` |
| **Chess Dojo** | `chessDojo.ts` AI tiers, `metaStore` skill points, `ChessDojo.vue` |
| **Supporter Club** | `SupporterStore.vue` — QoL-only `metaStore` perks (offline ×1.5, auto-shop, advanced log) |
| **Versioning** | `src/version.ts`, save `v0.3`, meta `v2`, migration from v0.2 keys |
| **Tests** | 281 Vitest · `vue-tsc -b` clean |

**Code map:** `src/version.ts`, `src/store/metaStore.ts`, `src/components/ArenaLoadout.vue`, `src/components/ChessDojo.vue`, `src/components/SupporterStore.vue`, `src/engine/chessDojo.ts`, `src/engine/supporterQoL.ts`.

### v0.2.1 implementation (client)

| Area | Change |
|------|--------|
| Click damage | Board tap → `clickEnemyPiece`; stamina + combat-time 2.5s cooldown |
| Board input | **Strike** / **Move** focus — no strike-on-move conflict |
| Combat movement | Line pieces stop **beside** ranged targets (`combatMovement.ts`) |
| Wave spawn | Occupancy-aware procedural spawn; no invisible overlap on King/slots |
| Army prep | Super-promotions persist waves; `relocateArmyToPrepRanks` + queen-favored auto-promo |
| King death | Fail wave, overlay, restore King at e1; rewind to last milestone checkpoint or 80% enemy HP on same-stage retry |
| Tests | **233+** Vitest cases (`ghostSystem`, `pvpGhost` AI, wave/combat/store) |

**Code map:** `src/store/gameStore.ts`, `src/engine/waveState.ts`, `src/engine/combatMovement.ts`, `src/engine/combatTime.ts`, `src/engine/stageManager.ts`, `src/engine/ghostSystem.ts`, `src/engine/grandmasterBoss.ts`, `src/components/ChessBoard.vue`, `src/components/WaveControls.vue`.

---

## 9. Multiplayer & PvP (Future Vision)

**Status:** Long-term roadmap — **Phase 8.8 prep shipped** (army snapshots, local ghost DB, draft matchmaking, PvP ghost AI). Live servers / UI still future.

**Ghost army snapshot (schema `0.8.0`):** Each piece stores `kind`, `position`, `stats` (hp/maxHp/ap/def), `upgradeLevels`, optional `superForm` + `superTraits`, optional `slotIndex`. Payload includes `sourceStage`, `powerScore`, `exportedAtMs`. Import rebuilds `playerPieces` with fresh initiative timers.

**Arena AI:** Set `combatMode: 'pvpGhost'` on `AiScoreContext` when driving ghost armies — overrides wave-mode pawn marching with `PVP_GHOST_WEIGHTS` (protect King, king shelter, king retreat, block threat lanes).

**Local ghost DB:** `saveGhostArmy` / `selectGhostOpponent` — `localStorage` until backend exists.

Builds on the existing initiative combat loop (§1.4.1, §1.5) and single-player army progression (§1.3, §3).

**Design intent:** Extend Idle Chess RPG from solo wave-clearing into **asynchronous and live PvP** where single-player investment (piece unlocks, upgrade levels, super-promotions) translates into **tactical army-building power** — not raw stat inflation in fair modes.

| Pillar | Intent |
|--------|--------|
| **Point-Buy Fairness** | Ranked matches are decided by build efficiency and in-match play, not account age |
| **SP → MP Bridge** | Unranked lets grinders flex oversized armies earned through idle progression |
| **Same Combat DNA** | HP/AP/DEF, line slam, initiative bars, manual turns — no second ruleset |
| **Deploy Phase** | Both players place armies on their half before the initiative clock starts |

---

### 9.1 Point-Buy Army Building

Before a match, each player constructs a **custom roster** on their deploy ranks (same 8×8 board; standard orientation — player A ranks 0–1, player B ranks 6–7 or mirrored spawn zones TBD).

Every piece placed on the board carries a dynamically calculated **Point Cost (PC)** derived from:

| Cost Input | Source |
|------------|--------|
| **Base type** | Tier table: Pawn < Knight/Bishop < Rook < Queen < King (King always required, 1 per army) |
| **Upgrade levels** | Current AP, HP, DEF, and Initiative track levels from SP progression (or PvP-specific caps in Ranked) |
| **Super-promotion overlay** | Super-Knight / Super-Bishop / Super-Rook / Super-Queen forms add a premium multiplier on top of scaled pawn stats |
| **Initiative speed** | Faster intervals (lower `ActionInterval`) increase PC — speed is treated as a premium stat in PvP valuation |

**Draft formula (tuning target — not final balance):**

```
PiecePC =
  BasePC[kind]
  × (1 + 0.08 × (AP_level - 1))
  × (1 + 0.06 × (HP_level - 1))
  × (1 + 0.05 × (DEF_level - 1))
  × (1 + 0.10 × INI_level)
  × SuperFormMult[form]    // 1.0 if none; 1.4–2.2 if super-promoted
```

| Piece | BasePC (draft) |
|-------|----------------|
| Pawn | 40 |
| Knight / Bishop | 120 |
| Rook | 200 |
| Queen | 320 |
| King | 150 (mandatory) |

**Army total:** `ArmyPC = Σ PiecePC` for all deployed pieces. UI shows running total vs. cap; invalid layouts (over cap, missing King, illegal deploy squares) block **Ready**.

**Restrictions (both modes):**

- Exactly **one King** per army (loss = defeat, same as SP).
- Deploy only on legal prep ranks for that side.
- Board slot limit from SP meta (`deploySlots`) may apply in Unranked; Ranked uses a fixed slot count (e.g. 8) for parity.
- Super-promotions **consume higher PC** — bringing a Super-Queen army is possible but leaves fewer supporting pieces under the cap.

---

### 9.2 Ranked Mode (Fair Play)

**Audience:** Competitive players who want chess-tactics-meets-autobattler skill expression without pay-to-win.

| Rule | Detail |
|------|--------|
| **Point cap** | Both players restricted to an **identical fixed cap** (draft: **1,000 PC**) regardless of SP progress |
| **Stat normalization** | Optional **Ranked stat clamp** — upgrade levels capped at a season baseline (e.g. AP/HP/DEF L15, INI L5) so veterans cannot smuggle L50 grinds into Ranked via point math alone |
| **Roster access** | All piece **types** unlocked for Ranked army builder; only **point budget** limits composition |
| **Matchmaking** | Elo-based (separate **PvP Elo** from prestige Elo Shards — see §9.5) |
| **Success factors** | Build efficiency (PC spent vs. threat coverage), initiative layering, focus fire, King shelter |

Ranked is the **primary esports / retention loop** for MP: small meta shifts (seasonal PC retunes) without invalidating SP progression.

---

### 9.3 Unranked Mode (Power Fantasy)

**Audience:** Players who want to **flex single-player investment** in chaotic, high-stakes brawls.

| Rule | Detail |
|------|--------|
| **Scaling cap** | Player's point cap scales with **SP progression** — draft: `Cap = 800 + 12 × maxStageEverReached + floor(lifetimeGold / 500_000)` (soft cap ~3,000–4,000 at endgame) |
| **Full stat import** | Actual upgrade levels and equipped super-promotions from the player's SP roster feed directly into PC and combat stats |
| **Matchmaking** | Casual queue; optional friend codes; no PvP Elo impact |
| **Fantasy beat** | Stage-50 grinder deploys 12+ upgraded pieces + multiple super-promotions vs. another whale — **numbers fly, boards explode** |

Unranked is the **SP → MP bridge**: idle progression unlocks bigger armies, not automatic Ranked advantage.

---

### 9.4 Combat Resolution (Live PvP)

The **same initiative system** as single-player manual mode (§1.4.1) governs live matches — no simultaneous real-time RTS.

| Phase | Behavior |
|-------|----------|
| **Deploy** | Both players place pieces within PC cap; **Ready** locks layout; no moves until both ready |
| **Initiative clock** | Shared server-authoritative `combatTimeMs`; bars fill per `ActionInterval` |
| **Turn order** | Next actor = earliest `nextActionAtMs` among **both** rosters (same as `getNextReadyActor`) |
| **Player input** | When **your** piece's bar is full, initiative **pauses for you**; you tap a legal destination (Move) or enemy (Strike if enabled in PvP ruleset) |
| **Opponent input** | Same for opponent's pieces on their client |
| **Timeout** | If no move within **N seconds** (draft: 30s), auto-select best heuristic move for that piece (prevents stalling) |
| **Win condition** | Destroy opponent King (HP → 0 or capture off board) |
| **Draw** | Optional: mutual King below 10% HP after 300 actions, or agreed stalemate timer |

**Disabled in Ranked (draft):** Royal Decree (solo-King only), Immortal Game revive, offline drip, AI auto-play. **Click damage** optional — if enabled, both players get identical stamina/cooldown rules.

**Spectator / replay:** Move log + initiative timestamps enable VOD and dispute resolution on the server.

---

### 9.5 Meta & Progression Bridge

| SP System | MP Role |
|-----------|---------|
| Prestige Elo Shards | **Not** PvP rating — remains PvE meta currency |
| Trophies / Stage milestones | Unlock **cosmetic** board themes, piece skins for PvP |
| Super-promotions | High-PC assets in Unranked; normalized or banned above cap in Ranked |
| Lifetime stats (Phase 8) | Feed Unranked cap formula; achievement flair in profile |

**PvP Elo (separate):** Win/Loss in Ranked only; seasonal resets optional. Placement matches calibrate starting rating.

---

### 9.6 Technical Preconditions (High Level)

Before MP ships, single-player must guarantee:

- Deterministic combat resolution (`resolveCombatMove`, initiative scheduling) for server replay validation
- Serializable board + piece state (`ChessPiece`, upgrade levels, super-promotion overlays)
- Authoritative initiative clock sync (see `tasks.md` Phase 9)

**Out of scope for first MP milestone:** Cross-platform accounts, ranked seasons with rewards, spectator mode, async "play by mail" — may follow after live 1v1 proof-of-concept.
