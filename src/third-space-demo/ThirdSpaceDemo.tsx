import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, RotateCcw, SlidersHorizontal } from "lucide-react";
import { TRAINERS } from "../../third-space-shared/catalogue";
import { CLUBS } from "../../third-space-shared/locations";
import { BUDGET_QUICK_REPLIES, OPENING_MESSAGE, type DemoMessage, type ThirdSpaceMatch, type ThirdSpaceMatches } from "../../third-space-shared/contract";
import { findThirdSpaceMatches, runThirdSpaceTurn } from "./api";
import { Conversation } from "./Conversation";
import { ProfilePanel } from "./ProfilePanel";

type Screen = "landing" | "chat" | "matching" | "matches";
type FailedRequest = { stage: "turn" | "matching"; messages: DemoMessage[] };
const initialMessages = (): DemoMessage[] => [{ role: "assistant", content: OPENING_MESSAGE }];
const startingReplies = ["Build strength", "Improve my fitness", "Feel confident in the gym", "Train for an event"];

function Brand() {
  return <img className="ts-brand__logo" src="/third-space-demo/third-space-logo.svg" alt="Third Space" width="175" height="18" />;
}

function Landing({ onStart }: { onStart: () => void }) {
  const reducedMotion = useReducedMotion();
  return <main className="ts-landing">
    <img className="ts-landing__image" src="/third-space-demo/hero.webp" alt="Personal training at Third Space London" fetchPriority="high" />
    <div className="ts-landing__shade" />
    <motion.div className="ts-landing__content" initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.7, delay: reducedMotion ? 0 : 0.1 }}>
      <h1>Find your<br /><em>kind of trainer.</em></h1>
      <p>Your goals. Your routine. Your way of training.<br className="ts-desktop-break" /> Let’s find the person to bring it all together.</p>
      <button className="ts-button ts-button--light" onClick={onStart}>Find my trainer <ArrowRight size={19} strokeWidth={1.6} /></button>
    </motion.div>
    <div className="ts-landing__foot"><span>AI matchmaking demo <span aria-hidden="true">·</span> Powered by <a href="https://joinpetey.com" target="_blank" rel="noopener noreferrer">Petey<span className="ts-sr-only"> (opens in a new tab)</span></a></span></div>
  </main>;
}

function MatchCard({ match, index, onOpen }: { match: ThirdSpaceMatch; index: number; onOpen: (match: ThirdSpaceMatch) => void }) {
  const trainer = TRAINERS.find((item) => item.id === match.trainerId)!;
  const club = CLUBS.find((item) => item.id === match.clubId);
  const reducedMotion = useReducedMotion();
  return <motion.article className="ts-match" initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : index * 0.1 }}>
    <button className="ts-trainer-card" aria-label={`View ${trainer.name}’s profile`} onClick={() => onOpen(match)}>
      <img src={trainer.photoUrl} alt="" loading={index === 0 ? "eager" : "lazy"} />
      <span className="ts-trainer-card__club">{club?.name}</span>
      <span className="ts-trainer-card__bottom"><span className="ts-trainer-card__name">{trainer.name}</span><span className="ts-trainer-card__arrow" aria-hidden="true"><ArrowUpRight size={21} strokeWidth={1.5} /></span></span>
    </button>
    <div className="ts-match__reasons"><h2>A fit for you</h2><ul className="ts-reasons">{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="ts-match__location"><MapPin size={15} aria-hidden="true" />{match.locationReason}</p></div>
  </motion.article>;
}

function Matches({ result, onRefine, onOpen }: { result: ThirdSpaceMatches; onRefine: () => void; onOpen: (match: ThirdSpaceMatch) => void }) {
  return <main className="ts-results">
    <div className="ts-results__heading"><div><h1>{result.matches.length > 0 ? "Your people. Your potential." : "Let’s open up the possibilities."}</h1><p>{result.matches.length > 0 ? "Selected around you, with a reason for every match." : (result.emptyReason || "We couldn’t find a strong match within your current preferences.")}</p></div><button className="ts-button ts-button--outline" onClick={onRefine}><SlidersHorizontal size={17} />Refine my matches</button></div>
    {result.brief.goal ? <p className="ts-results__brief">{result.brief.goal}</p> : null}
    {result.matches.length > 0 ? <div className="ts-match-grid">{result.matches.map((match, index) => <MatchCard key={match.trainerId} match={match} index={index} onOpen={onOpen} />)}</div> : <div className="ts-empty"><p>Tell us what you’d be happy to adjust — such as your training area or coaching preferences.</p><button className="ts-button ts-button--light" onClick={onRefine}>Talk it through <ArrowRight size={18} /></button></div>}
    <div className="ts-results__notes"><p>Personal training starts from £85/hour. Individual prices and availability need confirming.</p>{result.brief.membership !== "member" ? <p>A Third Space membership is needed to train at the clubs.</p> : null}{result.unconfirmed.filter((note) => !/^Individual trainer (prices|rates).*availability/i.test(note) && !(result.brief.membership !== "member" && /membership.*(?:is needed to train|is required)/i.test(note))).map((note) => <p key={note}>{note}</p>)}</div>
    <footer className="ts-results__footer"><span>AI matchmaking demo <span aria-hidden="true">·</span> 40 trainers from the Third Space directory</span><span>Powered by <a href="https://joinpetey.com" target="_blank" rel="noopener noreferrer">Petey<span className="ts-sr-only"> (opens in a new tab)</span></a></span></footer>
  </main>;
}

export function ThirdSpaceDemo() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [messages, setMessages] = useState<DemoMessage[]>(initialMessages);
  const [quickReplies, setQuickReplies] = useState(startingReplies);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ThirdSpaceMatches | null>(null);
  const [selected, setSelected] = useState<ThirdSpaceMatch | null>(null);
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
      const result = await findThirdSpaceMatches(transcript);
      if (version.current !== requestVersion) return;
      if (result.matches.length > 3 || result.matches.some((match) => !TRAINERS.some((trainer) => trainer.id === match.trainerId && trainer.clubIds.includes(match.clubId))
        || !Array.isArray(match.reasons) || match.reasons.length === 0)) throw new Error("Invalid matching response");
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
      const turn = await runThirdSpaceTurn(transcript);
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
    className={`ts-app ts-app--${screen}`}
    initial={reducedMotion ? false : { opacity: 0 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: reducedMotion || screen !== "landing" ? 0 : -22 }}
    transition={{ duration: reducedMotion ? 0 : screen === "landing" ? 0.28 : 0.32, ease: [0.22, 1, 0.36, 1] }}
  >
    <a className="ts-skip-link" href="#ts-main">Skip to content</a>
    <header className="ts-header"><Brand />{screen === "chat" ? <h1 className="ts-header__title">{refining ? "Make it more you." : "Let’s find your fit."}</h1> : null}{screen === "landing" ? <span className="ts-header__label">Find a personal trainer</span> : <div className="ts-header__actions">{screen === "chat" && refining && matches ? <button className="ts-text-button" onClick={() => setScreen("matches")} disabled={pending}><ArrowLeft size={16} />My matches</button> : null}<button className="ts-text-button" ref={resetTrigger} onClick={() => setResetRequested(true)}><RotateCcw size={15} /><span>Start again</span></button></div>}</header>
    <div id="ts-main" tabIndex={-1}>
      {screen === "landing" ? <Landing onStart={() => setScreen("chat")} /> : null}
      {screen === "chat" ? <Conversation messages={messages} quickReplies={quickReplies} pending={pending} error={error} onSend={send} onRetry={() => void retry()} /> : null}
      {screen === "matching" ? <main className="ts-matching"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.5 }}><div className={`ts-match-mark${error ? " ts-match-mark--still" : ""}`} aria-hidden="true"><i /><i /><i /></div><h1>{error ? "Let’s try that again." : "Finding your trainer."}</h1><p role={error ? "alert" : "status"}>{error || "Connecting your goals, your routine and the right expertise."}</p>{error ? <button className="ts-button ts-button--light" onClick={() => void retry()}><RotateCcw size={17} />Try again</button> : null}</motion.div></main> : null}
      {screen === "matches" && matches ? <Matches result={matches} onRefine={refine} onOpen={setSelected} /> : null}
    </div>
    <AnimatePresence>{selected && selectedTrainer ? <ProfilePanel trainer={selectedTrainer} club={CLUBS.find((club) => club.id === selected.clubId)} match={selected} onClose={() => setSelected(null)} /> : null}</AnimatePresence>
    {resetRequested ? <dialog ref={resetDialog} className="ts-reset-dialog" aria-labelledby="ts-reset-title" onCancel={(event) => { event.preventDefault(); setResetRequested(false); }}><h2 id="ts-reset-title">Start a new conversation?</h2><p>Your current answers and matches will be cleared.</p><div><button className="ts-button ts-button--outline" autoFocus onClick={() => setResetRequested(false)}>Keep my conversation</button><button className="ts-button ts-button--light" onClick={reset}>Start again</button></div></dialog> : null}
  </motion.div></AnimatePresence>;
}
