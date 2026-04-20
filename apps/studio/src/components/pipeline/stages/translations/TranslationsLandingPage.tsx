import { useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import { useLingui } from "@lingui/react/macro"
import { Trans } from "@lingui/react/macro"
import { useBookRun } from "@/hooks/use-book-run"
import { useApiKey } from "@/hooks/use-api-key"
import { usePrerequisiteChecks } from "@/hooks/use-prerequisite-checks"
import { useStageStatus } from "@/hooks/use-stage-status"
import { LandingPageShell } from "../../components/LandingPageShell"
import { RunProgress } from "../../components/RunProgress"
import { PrerequisiteWarnings } from "../../components/PrerequisiteWarnings"

// ─── Mock translation preview ────────────────────────────────────────────────

type LangCode = "EN" | "ES" | "PT" | "FR"

/* eslint-disable lingui/no-unlocalized-strings */
const LANGUAGES: { code: LangCode; name: string }[] = [
  { code: "EN", name: "English" },
  { code: "ES", name: "Spanish" },
  { code: "PT", name: "Portuguese" },
  { code: "FR", name: "French" },
]

const CONTENT: Record<LangCode, { chapter: string; left: string[]; right: string[] }> = {
  EN: {
    chapter: "Chapter One",
    left: [
      "Every living organism requires energy to survive. From the simplest bacteria to the most complex mammals, the ability to convert nutrients into usable energy is fundamental to life.",
      "In eukaryotic cells, this process is carried out by specialized structures known as organelles, each performing distinct roles within the cell.",
      "Mitochondria are often called the powerhouses of the cell. They produce adenosine triphosphate (ATP) through a process known as cellular respiration.",
      "Each mitochondrion has a double membrane. The outer membrane is smooth, while the inner one folds into cristae that increase the available surface area.",
      "Muscle cells, for instance, contain thousands of mitochondria to sustain prolonged physical activity over long periods of time.",
      "Scientists believe mitochondria were once free-living bacteria that entered a symbiotic relationship with ancient host cells.",
      "This endosymbiotic theory is supported by the fact that mitochondria possess their own circular DNA and replicate independently of the rest of the cell.",
      "The process of oxidative phosphorylation occurs along the inner membrane and is the primary mechanism by which cells generate most of their ATP.",
      "Electrons move through a series of protein complexes, creating a proton gradient that drives the ATP synthase enzyme.",
      "Without functional mitochondria, complex life as we know it would not be possible — every demanding activity ultimately depends on their output.",
    ],
    right: [
      "Inside each mitochondrion, the inner membrane forms a series of folds called cristae. These folds dramatically increase the surface area for chemical reactions.",
      "Mitochondria are unique among organelles because they contain their own DNA. This mitochondrial DNA is inherited exclusively from the mother.",
      "The presence of their own genetic material supports the theory of endosymbiosis, which proposes mitochondria were once free-living bacteria.",
      "Beyond energy production, mitochondria play a vital role in apoptosis — programmed cell death that removes damaged or unneeded cells.",
      "Dysfunction in mitochondria has been linked to neurodegenerative disorders like Parkinson's and Alzheimer's, sparking active research.",
      "Recent advances in gene therapy have opened new possibilities for treating mitochondrial diseases and restoring cellular function.",
      "Mitochondria are also involved in calcium signaling, helping the cell respond to changes in its environment with remarkable precision.",
      "They regulate the production of reactive oxygen species, which can cause cellular damage when left unchecked and lead to accelerated aging.",
      "Exercise has been shown to stimulate the growth of new mitochondria, a process known as mitochondrial biogenesis that improves endurance.",
      "The study of mitochondrial function continues to reveal new connections between cellular energy and overall human health.",
    ],
  },
  ES: {
    chapter: "Capítulo Uno",
    left: [
      "Todo organismo vivo necesita energía para sobrevivir. Desde las bacterias más simples hasta los mamíferos más complejos, la capacidad de convertir nutrientes en energía utilizable es fundamental para la vida.",
      "En las células eucariotas, este proceso es llevado a cabo por estructuras especializadas conocidas como orgánulos, cada uno cumpliendo funciones distintas dentro de la célula.",
      "Las mitocondrias son a menudo llamadas las centrales eléctricas de la célula. Producen adenosín trifosfato (ATP) a través de la respiración celular.",
      "Cada mitocondria tiene una doble membrana. La externa es lisa, mientras que la interna se pliega en crestas que aumentan la superficie disponible.",
      "Las células musculares, por ejemplo, contienen miles de mitocondrias para sostener actividad física prolongada durante largos periodos.",
      "Los científicos creen que las mitocondrias fueron alguna vez bacterias de vida libre que establecieron una relación simbiótica con células huésped antiguas.",
      "Esta teoría endosimbiótica se apoya en el hecho de que las mitocondrias poseen su propio ADN circular y se replican de forma independiente del resto de la célula.",
      "El proceso de fosforilación oxidativa ocurre a lo largo de la membrana interna y es el principal mecanismo por el cual las células generan la mayor parte de su ATP.",
      "Los electrones se mueven a través de una serie de complejos proteicos, creando un gradiente de protones que impulsa la enzima ATP sintasa.",
      "Sin mitocondrias funcionales, la vida compleja tal como la conocemos no sería posible — cada actividad exigente depende en última instancia de su producción.",
    ],
    right: [
      "Dentro de cada mitocondria, la membrana interna forma una serie de pliegues llamados crestas. Aumentan dramáticamente la superficie para las reacciones químicas.",
      "Las mitocondrias son únicas entre los orgánulos porque contienen su propio ADN. Este ADN mitocondrial se hereda exclusivamente de la madre.",
      "La presencia de su propio material genético respalda la teoría de la endosimbiosis, que propone que las mitocondrias fueron alguna vez bacterias de vida libre.",
      "Más allá de la producción de energía, las mitocondrias desempeñan un papel vital en la apoptosis — la muerte celular programada.",
      "La disfunción mitocondrial se ha relacionado con trastornos neurodegenerativos como el Parkinson y el Alzheimer, impulsando investigación activa.",
      "Los avances recientes en terapia génica han abierto nuevas posibilidades para tratar enfermedades mitocondriales y restaurar la función celular.",
      "Las mitocondrias también participan en la señalización del calcio, ayudando a la célula a responder a cambios en su entorno con notable precisión.",
      "Regulan la producción de especies reactivas de oxígeno, que pueden causar daño celular si no se controlan y conducir a un envejecimiento acelerado.",
      "El ejercicio estimula el crecimiento de nuevas mitocondrias, un proceso conocido como biogénesis mitocondrial que mejora la resistencia física.",
      "El estudio de la función mitocondrial continúa revelando nuevas conexiones entre la energía celular y la salud humana en general.",
    ],
  },
  PT: {
    chapter: "Capítulo Um",
    left: [
      "Todo organismo vivo requer energia para sobreviver. Desde as bactérias mais simples até os mamíferos mais complexos, a capacidade de converter nutrientes em energia utilizável é fundamental para a vida.",
      "Nas células eucarióticas, este processo é realizado por estruturas especializadas conhecidas como organelas, cada uma desempenhando funções distintas dentro da célula.",
      "As mitocôndrias são frequentemente chamadas de usinas de energia da célula. Elas produzem adenosina trifosfato (ATP) através da respiração celular.",
      "Cada mitocôndria tem uma dupla membrana. A externa é lisa, enquanto a interna se dobra em cristas que aumentam a superfície disponível.",
      "As células musculares, por exemplo, contêm milhares de mitocôndrias para sustentar atividade física prolongada por longos períodos de tempo.",
      "Os cientistas acreditam que as mitocôndrias foram um dia bactérias de vida livre que estabeleceram uma relação simbiótica com células hospedeiras antigas.",
      "Esta teoria endossimbiótica é apoiada pelo fato de as mitocôndrias possuírem seu próprio DNA circular e se replicarem de forma independente do restante da célula.",
      "O processo de fosforilação oxidativa ocorre ao longo da membrana interna e é o principal mecanismo pelo qual as células geram a maior parte de seu ATP.",
      "Os elétrons se movem através de uma série de complexos proteicos, criando um gradiente de prótons que impulsiona a enzima ATP sintase.",
      "Sem mitocôndrias funcionais, a vida complexa como a conhecemos não seria possível — toda atividade exigente depende, em última análise, de sua produção.",
    ],
    right: [
      "Dentro de cada mitocôndria, a membrana interna forma uma série de dobras chamadas cristas. Elas aumentam dramaticamente a superfície para reações químicas.",
      "As mitocôndrias são únicas entre as organelas porque contêm seu próprio DNA. Este DNA mitocondrial é herdado exclusivamente da mãe.",
      "A presença de seu próprio material genético apoia a teoria da endossimbiose, que propõe que as mitocôndrias foram um dia bactérias de vida livre.",
      "Além da produção de energia, as mitocôndrias desempenham um papel vital na apoptose — a morte celular programada.",
      "A disfunção mitocondrial tem sido ligada a distúrbios neurodegenerativos como Parkinson e Alzheimer, impulsionando pesquisas ativas.",
      "Avanços recentes na terapia gênica abriram novas possibilidades para tratar doenças mitocondriais e restaurar a função celular.",
      "As mitocôndrias também participam da sinalização de cálcio, ajudando a célula a responder a mudanças em seu ambiente com notável precisão.",
      "Elas regulam a produção de espécies reativas de oxigênio, que podem causar danos celulares se não forem controladas e levar ao envelhecimento acelerado.",
      "O exercício estimula o crescimento de novas mitocôndrias, um processo conhecido como biogênese mitocondrial que melhora a resistência física.",
      "O estudo da função mitocondrial continua a revelar novas conexões entre a energia celular e a saúde humana em geral.",
    ],
  },
  FR: {
    chapter: "Chapitre Premier",
    left: [
      "Tout organisme vivant a besoin d'énergie pour survivre. Des bactéries les plus simples aux mammifères les plus complexes, la capacité de convertir les nutriments en énergie utilisable est fondamentale à la vie.",
      "Dans les cellules eucaryotes, ce processus est réalisé par des structures spécialisées appelées organites, chacune remplissant des rôles distincts dans la cellule.",
      "Les mitochondries sont souvent appelées les centrales énergétiques de la cellule. Elles produisent l'adénosine triphosphate (ATP) par la respiration cellulaire.",
      "Chaque mitochondrie possède une double membrane. L'externe est lisse, tandis que l'interne se plie en crêtes qui augmentent la surface disponible.",
      "Les cellules musculaires, par exemple, contiennent des milliers de mitochondries pour soutenir une activité physique prolongée sur de longues périodes.",
      "Les scientifiques pensent que les mitochondries étaient autrefois des bactéries libres qui ont établi une relation symbiotique avec des cellules hôtes anciennes.",
      "Cette théorie endosymbiotique est soutenue par le fait que les mitochondries possèdent leur propre ADN circulaire et se répliquent indépendamment du reste de la cellule.",
      "Le processus de phosphorylation oxydative se déroule le long de la membrane interne et constitue le principal mécanisme par lequel les cellules produisent la majorité de leur ATP.",
      "Les électrons se déplacent à travers une série de complexes protéiques, créant un gradient de protons qui actionne l'enzyme ATP synthase.",
      "Sans mitochondries fonctionnelles, la vie complexe telle que nous la connaissons ne serait pas possible — toute activité exigeante dépend en dernière analyse de leur production.",
    ],
    right: [
      "À l'intérieur de chaque mitochondrie, la membrane interne forme une série de plis appelés crêtes. Ils augmentent considérablement la surface pour les réactions chimiques.",
      "Les mitochondries sont uniques parmi les organites car elles contiennent leur propre ADN. Cet ADN mitochondrial est hérité exclusivement de la mère.",
      "La présence de leur propre matériel génétique soutient la théorie de l'endosymbiose, qui propose que les mitochondries étaient autrefois des bactéries libres.",
      "Au-delà de la production d'énergie, les mitochondries jouent un rôle vital dans l'apoptose — la mort cellulaire programmée.",
      "Le dysfonctionnement mitochondrial a été lié à des troubles neurodégénératifs comme Parkinson et Alzheimer, stimulant des recherches actives.",
      "Les progrès récents en thérapie génique ont ouvert de nouvelles possibilités pour traiter les maladies mitochondriales et restaurer la fonction cellulaire.",
      "Les mitochondries participent également à la signalisation du calcium, aidant la cellule à répondre aux changements de son environnement avec une précision remarquable.",
      "Elles régulent la production d'espèces réactives de l'oxygène, qui peuvent causer des dommages cellulaires non contrôlés et accélérer le vieillissement.",
      "L'exercice stimule la croissance de nouvelles mitochondries, un processus appelé biogenèse mitochondriale qui améliore l'endurance physique.",
      "L'étude de la fonction mitochondriale continue de révéler de nouveaux liens entre l'énergie cellulaire et la santé humaine en général.",
    ],
  },
}

/* eslint-enable lingui/no-unlocalized-strings */

function MockTranslationPreview() {
  const [lang, setLang] = useState<LangCode>("ES") // eslint-disable-line lingui/no-unlocalized-strings
  const { chapter, left, right } = CONTENT[lang]
  const langName = LANGUAGES.find((l) => l.code === lang)?.name ?? "English" // eslint-disable-line lingui/no-unlocalized-strings

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* Book page background — two-column text */}
      <div className="flex flex-1 min-h-0 bg-white">
        <div className="flex flex-1 gap-4 px-6 py-6">
          {/* Left column */}
          <div className="flex-1 flex flex-col gap-2">
            <p
              key={`chapter-${lang}`}
              className="text-center text-[13px] font-bold tracking-tight text-foreground animate-in fade-in duration-300"
            >
              {chapter}
            </p>
            {left.map((p, i) => (
              <p
                key={`${lang}-l-${i}`}
                className="text-[9px] leading-[13px] text-foreground/70 text-justify animate-in fade-in duration-300"
              >
                {p}
              </p>
            ))}
          </div>
          {/* Right column */}
          <div className="flex-1 flex flex-col gap-2">
            <p
              key={`${lang}-r-0`}
              className="text-[9px] leading-[13px] text-foreground/70 text-justify animate-in fade-in duration-300"
            >
              {right[0]}
            </p>
            <div className="w-full h-20 rounded bg-gradient-to-br from-pink-100 to-purple-100" />
            {right.slice(1).map((p, i) => (
              <p
                key={`${lang}-r-${i + 1}`}
                className="text-[9px] leading-[13px] text-foreground/70 text-justify animate-in fade-in duration-300"
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Accessibility menu popover — floats over the book content */}
      <div className="absolute top-6 right-5 w-[185px] pointer-events-auto">
        {/* Menu card */}
        <div className="bg-white rounded-xl shadow-xl border border-[#e2e8f0] overflow-hidden">
          <div className="pt-4 pb-1 text-center">
            <p className="text-[12px] font-bold text-foreground tracking-tight">
              <Trans>Accessibility menu</Trans>
            </p>
          </div>
          <div className="pb-1.5 text-center">
            <p className="text-[9px] text-blue-600 underline decoration-1 underline-offset-[2px]">
              <Trans>Settings</Trans>
            </p>
          </div>
          <div className="h-[1.5px] bg-blue-500" />

          {/* Language row */}
          <div className="px-3 pt-2 pb-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-foreground"><Trans>Language</Trans></span>
              <div className="flex items-center gap-1 border border-[#e5e5e5] rounded-md px-1.5 py-[2px] bg-white">
                <span className="text-[8px] text-foreground">{langName}</span>
                <ChevronDown className="w-2 h-2 text-foreground/60" />
              </div>
            </div>

            {/* Open dropdown — always visible, clickable to change preview language */}
            <div className="mt-1.5 flex flex-col rounded-md border border-[#e5e5e5] bg-white overflow-hidden shadow-sm">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`flex items-center justify-between px-2 py-1 text-[9px] transition-colors cursor-pointer ${
                    l.code === lang
                      ? "bg-pink-50 text-pink-700 font-semibold"
                      : "hover:bg-[#f5f5f5] text-foreground/70"
                  }`}
                >
                  <span>{l.name}</span>
                  {l.code === lang && <Check className="w-2.5 h-2.5 text-pink-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-hide menus row */}
          <div className="px-3 py-2 flex items-center justify-between border-t border-[#f5f5f5]">
            <span className="text-[10px] font-semibold text-foreground"><Trans>Auto-hide menus</Trans></span>
            <div className="w-6 h-3 bg-[#d4d4d4] rounded-full relative flex items-center">
              <div className="w-2.5 h-2.5 bg-white shadow rounded-full ml-[1px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main landing page ────────────────────────────────────────────────────────

export function TranslationsLandingPage({
  bookLabel,
}: {
  bookLabel: string
}) {
  const { t } = useLingui()
  const { queueRun } = useBookRun()
  const { apiKey, hasApiKey } = useApiKey()
  const { storyboardReady, hasNoPages, allPagesPruned, canRun, isLoading: prereqLoading } = usePrerequisiteChecks(bookLabel)
  const { isRunning, isCompleted, hasError } = useStageStatus("translate")

  const handleRun = () => {
    if (!hasApiKey || isRunning || !canRun) return
    queueRun({ fromStage: "translate", toStage: "translate", apiKey })
  }

  return (
    <LandingPageShell
      bookLabel={bookLabel}
      stageSlug="translate"
      colorClass="bg-pink-600 hover:bg-pink-700"
      isRunning={isRunning}
      isCompleted={isCompleted}
      hasError={hasError}
      canRun={canRun}
      extraDisabled={!hasApiKey}
      runLabel={<Trans>Run Translation</Trans>}
      rerunLabel={<Trans>Re-run</Trans>}
      previewLabel={t`Translation Preview`}
      onRun={handleRun}
      preview={
        isRunning ? (
          <div className="flex flex-1 items-center justify-center">
            <RunProgress stepKey="text-catalog" spinnerColorClass="text-pink-500" />
          </div>
        ) : (
          <MockTranslationPreview />
        )
      }
    >
      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a]">
          <Trans>Language</Trans>
        </h1>
        <p className="text-[14px] text-[#737373] leading-relaxed">
          <Trans>
            Translate your book's content into multiple languages. The translation
            pipeline builds a text catalog from all pages, quizzes, captions, and
            glossary entries, then translates each item into your configured
            output languages.
          </Trans>
        </p>
      </div>

      <PrerequisiteWarnings
        storyboardReady={storyboardReady}
        hasNoPages={hasNoPages}
        allPagesPruned={allPagesPruned}
        stageName="translations"
        isLoading={prereqLoading}
      />
    </LandingPageShell>
  )
}
