import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, RotateCcw, SlidersHorizontal } from "lucide-react";
import { TRAINERS } from "../../gymbox-shared/catalogue";
import { CLUBS } from "../../gymbox-shared/locations";
import { BUDGET_QUICK_REPLIES, OPENING_MESSAGE, type DemoMessage, type GymboxMatch, type GymboxMatches } from "../../gymbox-shared/contract";
import { findGymboxMatches, runGymboxTurn } from "./api";
import { Conversation } from "./Conversation";
import { ProfilePanel } from "./ProfilePanel";
import { sessionPrice } from "./price";

type Screen = "landing" | "chat" | "matching" | "matches";
type FailedRequest = { stage: "turn" | "matching"; messages: DemoMessage[] };
const initialMessages = (): DemoMessage[] => [{ role: "assistant", content: OPENING_MESSAGE }];
const startingReplies = ["Build muscle", "Run my first 5K", "Learn to lift weights"];

function Brand() {
  return <img className="gb-brand__logo" src="/gymbox-demo/gymbox-logo.png" alt="Gymbox" width="768" height="768" />;
}

function Landing({ onStart }: { onStart: () => void }) {
  const reducedMotion = useReducedMotion();
  return <main className="gb-landing">
    <motion.div className="gb-landing__content" initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.7, delay: reducedMotion ? 0 : 0.1 }}>
      <h1>Find your<br /><em>kind of trainer.</em></h1>
      <p>Your goals. Your routine. Your way of training.<br className="gb-desktop-break" /> Let’s find the person to bring it all together.</p>
      <button className="gb-button gb-button--light" onClick={onStart}>Find my trainer <ArrowRight size={19} strokeWidth={1.6} /></button>
    </motion.div>
    <motion.div className="gb-landing__media" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.8, delay: reducedMotion ? 0 : 0.2 }}>
      <img src="/gymbox-demo/hero-gymbox-1600.webp" srcSet="/gymbox-demo/hero-gymbox-800.webp 800w, /gymbox-demo/hero-gymbox-1600.webp 1600w, /gymbox-demo/hero-gymbox-4k.webp 3840w" sizes="(max-width: 900px) 100vw, 50vw" alt="A trainer and member chatting between sets in an imagined industrial gym" width="3840" height="2160" fetchPriority="high" />
    </motion.div>
    <div className="gb-landing__foot"><span>AI matchmaking demo with fictional trainers <span aria-hidden="true">·</span> Powered by <a href="https://joinpetey.com" target="_blank" rel="noopener noreferrer">Petey<span className="gb-sr-only"> (opens in a new tab)</span></a></span></div>
  </main>;
}

function MatchCard({ match, index, onOpen }: { match: GymboxMatch; index: number; onOpen: (match: GymboxMatch) => void }) {
  const trainer = TRAINERS.find((item) => item.id === match.trainerId)!;
  const firstName = trainer.name.split(" ")[0];
  const club = CLUBS.find((item) => item.id === match.clubId);
  const reducedMotion = useReducedMotion();
  return <motion.article className="gb-match" initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : index * 0.1 }}>
    <button className="gb-trainer-card" aria-label={`View ${firstName}’s profile`} aria-describedby={`gb-trainer-mega-${trainer.id}`} onClick={() => onOpen(match)}>
      <span className="gb-trainer-card__portrait" aria-hidden="true"><img src={trainer.photoUrl} alt="" loading={index === 0 ? "eager" : "lazy"} /></span>
      <span className="gb-trainer-card__meta" id={`gb-trainer-mega-${trainer.id}`}><span className="gb-trainer-card__club">{club?.name}</span><span className="gb-trainer-card__price">{sessionPrice(trainer.pricePerSessionGbp)}</span></span>
      <span className="gb-trainer-card__bottom"><span className="gb-trainer-card__name">{firstName}</span><span className="gb-trainer-card__arrow" aria-hidden="true"><ArrowUpRight size={21} strokeWidth={1.5} /></span></span>
    </button>
    <div className="gb-match__reasons"><h2>A fit for you</h2><ul className="gb-reasons">{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="gb-match__location"><MapPin size={15} aria-hidden="true" />{match.locationReason}</p></div>
  </motion.article>;
}

function Matches({ result, onRefine, onOpen }: { result: GymboxMatches; onRefine: () => void; onOpen: (match: GymboxMatch) => void }) {
  return <main className="gb-results">
    <div className="gb-results__heading"><div><h1>{result.matches.length > 0 ? "Meet your matches" : "Let’s open up the possibilities."}</h1><p>{result.matches.length > 0 ? "Selected around you, with a reason for every match." : (result.emptyReason || "We couldn’t find a strong match within your current preferences.")}</p></div><button className="gb-button gb-button--outline" onClick={onRefine}><SlidersHorizontal size={17} />Refine my matches</button></div>
    {result.matches.length > 0 ? <div className="gb-match-grid">{result.matches.map((match, index) => <MatchCard key={match.trainerId} match={match} index={index} onOpen={onOpen} />)}</div> : <div className="gb-empty"><p>You can refine your request or start again.</p><button className="gb-button gb-button--light" onClick={onRefine}>Talk it through <ArrowRight size={18} /></button></div>}
    <footer className="gb-results__footer">
      <span>AI matchmaking demo <span aria-hidden="true">·</span> {TRAINERS.length} fictional trainer profiles</span><span>Powered by <a href="https://joinpetey.com" target="_blank" rel="noopener noreferrer">Petey<span className="gb-sr-only"> (opens in a new tab)</span></a></span>
    </footer>
  </main>;
}

export function GymboxDemo() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [messages, setMessages] = useState<DemoMessage[]>(initialMessages);
  const [quickReplies, setQuickReplies] = useState(startingReplies);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<GymboxMatches | null>(null);
  const [selected, setSelected] = useState<GymboxMatch | null>(null);
  const [refining, setRefining] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const version = useRef(0);
  const busy = useRef(false);
  const failedRequest = useRef<FailedRequest | null>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const resetTrigger = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => {
    if (!resetRequested) return;
    const dialog = resetDialog.current!;
    const trigger = resetTrigger.current;
    dialog.showModal();
    return () => { dialog.close(); trigger?.focus(); };
  }, [resetRequested]);

  const requestMatches = useCallback(async (transcript: DemoMessage[], requestVersion: number) => {
    setScreen("matching");
    try {
      const result = await findGymboxMatches(transcript);
      if (version.current !== requestVersion) return;
      if (result.matches.length > 3 || new Set(result.matches.map((match) => match.trainerId)).size !== result.matches.length || result.matches.some((match) => !TRAINERS.some((trainer) => trainer.id === match.trainerId && trainer.clubIds.includes(match.clubId))
        || !Array.isArray(match.reasons) || match.reasons.length === 0 || match.reasons.length > 3 || match.reasons.some((reason) => typeof reason !== "string" || !reason.trim() || reason.length > 420) || typeof match.locationReason !== "string" || match.locationReason.length > 420)) throw new Error("Invalid matching response");
      setMatches(result);
      setScreen("matches");
    } catch {
      if (version.current !== requestVersion) return;
      failedRequest.current = { stage: "matching", messages: transcript };
      setError("We couldn’t find your matches just now. Your conversation is still here — please try again.");
    }
  }, []);

  const requestTurn = useCallback(async (transcript: DemoMessage[], requestVersion: number) => {
    try {
      const turn = await runGymboxTurn(transcript);
      if (version.current !== requestVersion) return;
      const nextMessages: DemoMessage[] = [...transcript, { role: "assistant", content: turn.reply }];
      setMessages(nextMessages);
      setQuickReplies(turn.topic === "budget" ? BUDGET_QUICK_REPLIES : turn.quickReplies);
      if (turn.readyForMatching) await requestMatches(nextMessages, requestVersion);
    } catch {
      if (version.current !== requestVersion) return;
      failedRequest.current = { stage: "turn", messages: transcript };
      setError("The AI couldn’t reply just now. Your answer is still here — please try again.");
    }
  }, [requestMatches]);

  const send = useCallback(async (text: string) => {
    if (version.current !== sessionVersion || busy.current || !text.trim()) return;
    busy.current = true;
    setPending(true);
    setError(null);
    failedRequest.current = null;
    const requestVersion = version.current;
    const transcript: DemoMessage[] = [...messages, { role: "user", content: text.trim().slice(0, 2000) }];
    setMessages(transcript);
    await requestTurn(transcript, requestVersion);
    if (version.current === requestVersion) { busy.current = false; setPending(false); }
  }, [messages, requestTurn, sessionVersion]);

  const retry = async () => {
    if (busy.current || !failedRequest.current) return;
    const failed = failedRequest.current;
    const requestVersion = version.current;
    busy.current = true;
    setPending(true);
    setError(null);
    failedRequest.current = null;
    if (failed.stage === "matching") await requestMatches(failed.messages, requestVersion);
    else await requestTurn(failed.messages, requestVersion);
    if (version.current === requestVersion) { busy.current = false; setPending(false); }
  };

  const reset = () => {
    version.current += 1;
    setSessionVersion(version.current);
    busy.current = false;
    failedRequest.current = null;
    setMessages(initialMessages());
    setQuickReplies(startingReplies);
    setPending(false);
    setError(null);
    setMatches(null);
    setSelected(null);
    setRefining(false);
    setResetRequested(false);
    setScreen("landing");
  };
  const refine = () => {
    setMessages((history) => {
      const prior = history.at(-1)?.role === "assistant" ? history.slice(0, -1) : history;
      return [...prior, { role: "assistant", content: "What would you like to change about your matches? You can tell me about your goals, training area or the kind of coach you’d like." }];
    });
    setQuickReplies([]);
    setRefining(true);
    setError(null);
    setScreen("chat");
  };
  const selectedTrainer = selected ? TRAINERS.find((trainer) => trainer.id === selected.trainerId) : undefined;

  return <AnimatePresence initial={false} mode="wait"><motion.div
    key={screen === "landing" ? "landing" : "journey"}
    className={`gb-app gb-app--${screen}`}
    initial={reducedMotion ? false : { opacity: 0 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: reducedMotion || screen !== "landing" ? 0 : -22 }}
    transition={{ duration: reducedMotion ? 0 : screen === "landing" ? 0.28 : 0.32, ease: [0.22, 1, 0.36, 1] }}
  >
    <a className="gb-skip-link" href="#gb-main">Skip to content</a>
    <header className="gb-header"><Brand />{screen === "chat" ? <h1 className="gb-header__title">{refining ? "Make it more you." : "Let’s find your fit."}</h1> : null}{screen === "landing" ? <span className="gb-header__label">Find a personal trainer</span> : <div className="gb-header__actions">{screen === "chat" && refining && matches ? <button className="gb-text-button" onClick={() => setScreen("matches")} disabled={pending}><ArrowLeft size={16} />My matches</button> : null}<button className="gb-text-button" ref={resetTrigger} onClick={() => setResetRequested(true)}><RotateCcw size={15} /><span>Start again</span></button></div>}</header>
    <div id="gb-main" tabIndex={-1}>
      {screen === "landing" ? <Landing onStart={() => setScreen("chat")} /> : null}
      {screen === "chat" ? <Conversation messages={messages} quickReplies={quickReplies} pending={pending} error={error} onSend={send} onRetry={() => void retry()} /> : null}
      {screen === "matching" ? <main className="gb-matching"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.5 }}><div className={`gb-match-mark${error ? " gb-match-mark--still" : ""}`} aria-hidden="true"><i /><i /><i /></div><h1>{error ? "Let’s try that again." : "Finding your trainer."}</h1><p role={error ? "alert" : "status"}>{error || "Connecting your goals, your routine and the right expertise."}</p>{error ? <button className="gb-button gb-button--light" onClick={() => void retry()}><RotateCcw size={17} />Try again</button> : null}</motion.div></main> : null}
      {screen === "matches" && matches ? <Matches result={matches} onRefine={refine} onOpen={setSelected} /> : null}
    </div>
    <AnimatePresence>{selected && selectedTrainer ? <ProfilePanel trainer={selectedTrainer} club={CLUBS.find((club) => club.id === selected.clubId)} match={selected} onClose={() => setSelected(null)} /> : null}</AnimatePresence>
    {resetRequested ? <dialog ref={resetDialog} className="gb-reset-dialog" aria-labelledby="gb-reset-title" onCancel={(event) => { event.preventDefault(); setResetRequested(false); }}><h2 id="gb-reset-title">Start a new conversation?</h2><p>Your current answers and matches will be cleared.</p><div><button className="gb-button gb-button--outline" autoFocus onClick={() => setResetRequested(false)}>Keep my conversation</button><button className="gb-button gb-button--light" onClick={reset}>Start again</button></div></dialog> : null}
  </motion.div></AnimatePresence>;
}
