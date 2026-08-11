import { useEffect } from 'react'
import { NeubruCard } from '../../components'
import { toast } from 'sonner'
import { useLevelStore } from '../../stores/levelStore'
import { useAuthStore } from '../../stores/authStore'

interface SkillNode {
  level: number
  label: string
  desc: string
  unlocked: boolean
  current: boolean
}

function buildNodes(skillLevel: number): SkillNode[] {
  const nodes: SkillNode[] = []
  for (let i = 1; i <= 10; i++) {
    nodes.push({
      level: i,
      label: getNodeLabel(i),
      desc: getNodeDesc(i),
      unlocked: skillLevel >= i,
      current: skillLevel === i,
    })
  }
  return nodes
}

function getNodeLabel(level: number): string {
  return `Lv. ${level}`
}

function getNodeDesc(level: number): string {
  return `Level ${level} bonus`
}

interface SkillTreeDefinition {
  id: 'wealth' | 'vitality' | 'wisdom'
  icon: string
  title: string
  color: string
  bonusLabel: (level: number) => string
  unlockLabel: (level: number) => string | null
}

const TREE_DEFS: SkillTreeDefinition[] = [
  {
    id: 'wealth',
    icon: '💰',
    title: 'Wealth',
    color: '#22c55e',
    bonusLabel: (level) => `${level}% savings bonus`,
    unlockLabel: (level) => {
      if (level >= 10) return 'FIRE projection unlocked'
      if (level >= 5) return 'Loan calculator unlocked'
      return null
    },
  },
  {
    id: 'vitality',
    icon: '💪',
    title: 'Vitality',
    color: '#ff8a00',
    bonusLabel: (level) => `${Math.floor(level / 3)} streak freeze(s)`,
    unlockLabel: (level) => {
      if (level >= 5) return 'Extra daily quest unlocked'
      return null
    },
  },
  {
    id: 'wisdom',
    icon: '🧠',
    title: 'Wisdom',
    color: '#8b5cf6',
    bonusLabel: (level) => `Wisdom level ${level}`,
    unlockLabel: (level) => {
      if (level >= 10) return 'Weekly reflection unlocked'
      if (level >= 7) return 'Notes search boost'
      if (level >= 3) return 'Journal templates unlocked'
      return null
    },
  },
]

export default function SkillTreePage() {
  const { xp, level, skillPoints, skills, spendSkillPoint } = useLevelStore()
  const currentXp = xp - (level - 1) * (level - 1) * 100
  const neededXp = level * level * 100 - (level - 1) * (level - 1) * 100
  const progressPct = neededXp > 0 ? Math.min(Math.round((currentXp / neededXp) * 100), 100) : 100

  const handleSpend = (tree: 'wealth' | 'vitality' | 'wisdom') => {
    if (skillPoints <= 0) {
      toast.error('No skill points available!')
      return
    }
    if (skills[tree] >= 10) {
      toast.error(`${tree} is already maxed out!`)
      return
    }
    spendSkillPoint(tree)
    toast.success(`Spent 1 point in ${tree}! (${skills[tree] + 1}/10)`)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <h2 className="text-[1.8rem]">🌟 Skill Tree</h2>
      </div>

      {/* Level overview */}
      <NeubruCard className="mb-7">
        <div className="flex items-center gap-4 flex-wrap">
          <div
            className="w-16 h-16 border-3 border-nb-border bg-nb-yellow flex items-center justify-center"
            style={{ boxShadow: '3px 3px 0 #0b0b0b' }}
          >
            <span className="text-2xl font-black">{level}</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-black text-lg">Level {level}</span>
              <span className="font-mono text-sm font-bold text-nb-fg-muted">
                ✦ {skillPoints} skill point{skillPoints !== 1 ? 's' : ''} available
              </span>
            </div>
            <div className="h-5 bg-nb-bg border-2 border-nb-border overflow-hidden mb-1">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #ffd800, #ff8a00)',
                }}
              />
            </div>
            <div className="text-xs font-bold text-nb-fg-muted font-mono">
              ⚡ {currentXp.toLocaleString()} / {neededXp.toLocaleString()} XP to Level {level + 1}
            </div>
          </div>
        </div>
      </NeubruCard>

      {/* Three skill columns */}
      <div className="grid grid-cols-3 gap-5 mb-7">
        {TREE_DEFS.map((tree) => {
          const nodes = buildNodes(skills[tree.id])
          return (
            <NeubruCard key={tree.id}>
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b-3 border-nb-border">
                <span className="text-2xl">{tree.icon}</span>
                <div>
                  <div className="font-black text-sm uppercase tracking-wide">{tree.title}</div>
                  <div className="text-xs text-nb-fg-muted font-bold">
                    {skills[tree.id]}/10
                  </div>
                </div>
              </div>

              {/* Current bonus */}
              <div
                className="mb-4 p-3 border-2 font-bold text-xs uppercase tracking-wide"
                style={{
                  borderColor: tree.color,
                  background: `${tree.color}15`,
                  color: tree.color,
                }}
              >
                {tree.bonusLabel(skills[tree.id])}
                {tree.unlockLabel(skills[tree.id]) && (
                  <span className="block mt-0.5 text-nb-fg-muted normal-case">
                    {tree.unlockLabel(skills[tree.id])}
                  </span>
                )}
              </div>

              {/* Node tree */}
              <div className="flex flex-col gap-2.5 mb-4">
                {nodes.map((node, idx) => (
                  <div key={node.level} className="flex items-center gap-3">
                    {/* Connector line */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className="w-5 h-5 border-2 flex items-center justify-center text-[10px] font-black"
                        style={{
                          borderColor: '#0b0b0b',
                          background: node.unlocked ? tree.color : '#e0e0e0',
                          color: node.unlocked ? '#fff' : '#888',
                        }}
                      >
                        {node.unlocked ? '✓' : node.level}
                      </div>
                      {idx < nodes.length - 1 && (
                        <div
                          className="w-0.5 h-3"
                          style={{ background: node.unlocked ? tree.color : '#d0d0d0' }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold uppercase">{node.label}</div>
                      <div className="text-[10px] text-nb-fg-muted font-medium">
                        {node.unlocked
                          ? tree.bonusLabel(node.level)
                          : 'Locked'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Spend point button */}
              <button
                onClick={() => handleSpend(tree.id)}
                disabled={skillPoints <= 0 || skills[tree.id] >= 10}
                className="w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all border-2"
                style={{
                  borderColor: '#0b0b0b',
                  background:
                    skillPoints <= 0 || skills[tree.id] >= 10
                      ? '#ccc'
                      : tree.color,
                  color: skillPoints <= 0 || skills[tree.id] >= 10 ? '#888' : '#fff',
                  boxShadow:
                    skillPoints <= 0 || skills[tree.id] >= 10
                      ? 'none'
                      : '3px 3px 0 #0b0b0b',
                  opacity: skillPoints <= 0 || skills[tree.id] >= 10 ? 0.5 : 1,
                  cursor: skillPoints <= 0 || skills[tree.id] >= 10 ? 'not-allowed' : 'pointer',
                }}
              >
                {skills[tree.id] >= 10
                  ? '✦ MAXED'
                  : skillPoints <= 0
                    ? '✦ No Points'
                    : `✦ Spend Point (${skillPoints} left)`}
              </button>
            </NeubruCard>
          )
        })}
      </div>

      {/* Daily Quests */}
      <DailyQuestsSection />
    </div>
  )
}

function DailyQuestsSection() {
  const { dailyQuests, dailyQuestDate, completeQuest, generateDailyQuests } = useLevelStore()
  const today = new Date().toISOString().slice(0, 10)

  // Reset quests if it's a new day
  useEffect(() => {
    if (dailyQuestDate !== today) {
      const userId = useAuthStore.getState().userId || 'default'
      generateDailyQuests(userId)
    }
  }, [dailyQuestDate, today, generateDailyQuests])

  const doneCount = dailyQuests.filter((q) => q.done).length
  const totalCount = dailyQuests.length

  return (
    <NeubruCard>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-black uppercase tracking-wide">📋 Daily Quests</div>
          <div className="text-xs text-nb-fg-muted font-bold mt-0.5">
            {doneCount}/{totalCount} completed
          </div>
        </div>
        <div className="text-xs font-mono font-bold text-nb-fg-muted">
          Resets at midnight
        </div>
      </div>

      {dailyQuests.length === 0 ? (
        <div className="text-center py-8 text-nb-fg-muted font-bold text-sm">
          Loading quests...
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dailyQuests.map((quest) => (
            <div
              key={quest.id}
              className="flex items-center justify-between gap-3 p-3 border-2 border-nb-border bg-white"
              style={{
                opacity: quest.done ? 0.6 : 1,
                boxShadow: quest.done ? 'none' : '2px 2px 0 #0b0b0b',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-5 h-5 border-2 border-nb-border flex items-center justify-center text-xs shrink-0"
                  style={{
                    background: quest.done ? '#22c55e' : '#fff',
                    color: quest.done ? '#fff' : '#0b0b0b',
                  }}
                >
                  {quest.done ? '✓' : ''}
                </div>
                <span
                  className={`text-sm font-bold truncate ${quest.done ? 'line-through' : ''}`}
                >
                  {quest.desc}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-bold text-nb-orange">
                  +{quest.xp} XP
                </span>
                {!quest.done && (
                  <button
                    onClick={() => {
                      completeQuest(quest.id)
                      toast.success(`Quest complete! +${quest.xp} XP`)
                    }}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-2 border-nb-border bg-nb-yellow cursor-pointer hover:shadow-nb-sm transition-all"
                  >
                    Claim
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </NeubruCard>
  )
}
