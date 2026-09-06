import { sampleVoices } from "../audio/sampleVoices";

export function VoiceOptions({ voices }: { voices: SpeechSynthesisVoice[] }) {
  return (
    <>
      <optgroup label="収録音声（インストール不要）">
        {sampleVoices.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="ブラウザ音声">
        <option value="">利用可能な最初の日本語音声</option>
        {voices.map((voice) => (
          <option key={voice.voiceURI} value={voice.voiceURI}>
            {voice.name}（{voice.localService ? "端末内" : "オンライン"}）
          </option>
        ))}
      </optgroup>
    </>
  );
}
