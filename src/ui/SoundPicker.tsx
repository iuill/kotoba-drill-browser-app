import { soundGroups } from "../core/materials";

export function SoundPicker({
  selected,
  onToggle,
  disabled = false,
}: {
  selected: string[];
  onToggle: (sound: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="sound-groups">
      {soundGroups.map((group) => (
        <div key={group.name} role="group" aria-label={group.name}>
          <h3>{group.name}</h3>
          <div className="sound-table-scroll" dir="rtl">
            <div
              className={`sound-grid ${group.columns === 3 ? "contracted" : ""}`}
              style={{
                gridTemplateColumns: `repeat(${group.rows.length}, minmax(2.75rem, 1fr))`,
              }}
            >
              {group.rows
                .flatMap((row) => row.split(" "))
                .map((sound, index) =>
                  sound === "-" ? (
                    <span key={`empty-${index}`} aria-hidden="true" />
                  ) : (
                    <button
                      key={sound}
                      disabled={disabled}
                      aria-pressed={selected.includes(sound)}
                      onClick={() => onToggle(sound)}
                    >
                      {sound}
                    </button>
                  ),
                )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
