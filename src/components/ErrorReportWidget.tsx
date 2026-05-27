import { useState } from "react";
import "./ErrorReportWidget.css";

interface ErrorReport {
  sourceFormat: string;
  targetFormat: string;
  errorMessage: string;
  description: string;
  email?: string;
}

interface ErrorReportWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  sourceFormat?: string;
  targetFormat?: string;
  errorMessage?: string;
}

const AUDIO_FORMATS = [
  "MP3", "WAV", "FLAC", "AAC", "OGG", "OGA", "M4A", "M4R", "OPUS",
  "WMA", "AIFF", "AIF", "AMR", "MP2", "AC3", "GSM", "CAF", "VOC",
  "WV", "AU", "DTS", "W64", "TTA", "8SVX", "IMA", "SPH", "RA", "SPX"
];

const IMAGE_FORMATS = ["JPG", "JPEG", "PNG", "WEBP", "AVIF", "GIF", "BMP", "TIFF", "TIF", "HEIC", "HEIF", "ICO", "CUR", "SVG", "PDF", "EPS",
  "PSD", "DDS", "HDR", "EXR", "TGA", "DNG", "PPM", "PGM", "PBM", "PNM", "PAM", "PFM", "XWD", "SUN", "RAS",
  "MTV", "PCD", "FTS", "RGBO", "IPL", "UYVY", "VIFF", "PALM", "HRZ", "XV", "PAL", "MNG", "JPS", "PICT", "PCT",
  "JBIG", "JBG", "RGF", "SIX", "SIXEL", "SGI", "FAX", "G3", "G4", "JFI", "JIF", "JPE", "YUV", "OTB", "VIPS", "MAP",
  "WBMP", "JP2", "J2K", "JPC", "PGX", "PICON", "PDB"];
const VIDEO_FORMATS = ["MP4", "WEBM", "MOV", "MKV", "AVI", "M4V", "FLV"];

export function ErrorReportWidget({ isOpen, onClose, sourceFormat, targetFormat, errorMessage }: ErrorReportWidgetProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [formError, setFormError] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>(
    targetFormat ? [targetFormat] : []
  );
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const toggleFormat = (fmt: string) => {
    setSelectedFormats(prev =>
      prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (selectedFormats.length === 0) {
      setFormError("Select at least one format that is failing.");
      return;
    }
    if (!description.trim()) {
      setFormError("Please describe the error.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/conversions/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceFormat: sourceFormat || "unknown",
          targetFormats: selectedFormats,
          errorMessage: errorMessage || "N/A",
          description: description.trim(),
          email: email.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to send report");
      setStep("success");
    } catch (err: any) {
      setFormError(err.message || "Error sending report. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setStep("form");
    setSelectedFormats(targetFormat ? [targetFormat] : []);
    setDescription("");
    setEmail("");
    setFormError("");
    onClose();
  };

  if (!isOpen) return null;

  const allFormats = [
    { category: "Audio", formats: AUDIO_FORMATS },
    { category: "Image", formats: IMAGE_FORMATS },
    { category: "Video", formats: VIDEO_FORMATS },
  ];

  return (
    <div className="error-report-overlay" onClick={handleClose}>
      <div className="error-report-modal" onClick={e => e.stopPropagation()}>
        {step === "form" ? (
          <>
            <div className="error-report-header">
              <h2>🐞 Report a Conversion Error</h2>
              <button className="error-report-close" onClick={handleClose}>×</button>
            </div>
            <div className="error-report-scroll">
              <form onSubmit={handleSubmit}>
                <p className="error-report-intro">
                  Help us improve Filefox! Select which format(s) are failing and describe the issue.
                </p>

                {sourceFormat && targetFormat && (
                  <div className="error-report-current">
                    <strong>Current conversion:</strong> {sourceFormat} → {targetFormat}
                    {errorMessage && (
                      <div className="error-report-err-msg">
                        <small>{errorMessage.slice(0, 200)}</small>
                      </div>
                    )}
                  </div>
                )}

                <div className="error-report-formats">
                  <label className="error-report-label">Which format(s) failed?</label>
                  {allFormats.map(group => (
                    <div key={group.category} className="error-report-group">
                      <span className="error-report-group-label">{group.category}</span>
                      <div className="error-report-format-grid">
                        {group.formats.map(fmt => (
                          <button
                            key={fmt}
                            type="button"
                            className={`error-report-chip ${selectedFormats.includes(fmt) ? "selected" : ""}`}
                            onClick={() => toggleFormat(fmt)}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="error-report-field">
                  <label className="error-report-label">Describe the error</label>
                  <textarea
                    className="error-report-textarea"
                    placeholder="What happened? What file were you trying to convert? Any details help..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="error-report-field">
                  <label className="error-report-label">Your email (optional)</label>
                  <input
                    type="email"
                    className="error-report-input"
                    placeholder="email@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                {formError && <p className="error-report-error">{formError}</p>}

                <div className="error-report-actions">
                  <button type="button" className="error-report-btn error-report-btn-cancel" onClick={handleClose}>
                    Cancel
                  </button>
                  <button type="submit" className="error-report-btn error-report-btn-submit" disabled={sending}>
                    {sending ? "Sending..." : "Send Report"}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="error-report-success">
            <div className="error-report-success-icon">🎉</div>
            <h2>Thank you for helping us improve!</h2>
            <p>Your report has been sent. Our team will review it and work on fixing the issue.</p>
            <button className="error-report-btn error-report-btn-submit" onClick={() => {
              window.location.href = "/";
            }}>
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
