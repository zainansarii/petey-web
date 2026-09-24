import { requestMagicLink } from "../api/magicLink";
import { EmailLinkScreen } from "./EmailLinkScreen";

type LoginScreenProps = {
  onBack: () => void;
  onLinkRequested: (email: string, mode: "sent" | "preview") => void;
};

export function LoginScreen({ onBack, onLinkRequested }: LoginScreenProps) {
  return <EmailLinkScreen onBack={onBack} onSubmit={async email => {
    const mode = await requestMagicLink(email);
    onLinkRequested(email, mode);
  }} />;
}
