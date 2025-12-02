import { useState, useCallback, useMemo } from "react";

// Move utility function outside component
const getFileName = (name) => (name?.replace(/\s+/g, "_") || "resume") + ".json";

// Memoize static styles outside component
const containerStyle = {
  maxWidth: 900,
  margin: "40px auto",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  background: "#f9f9f9",
  padding: "30px",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
};

const titleStyle = {
  textAlign: "center",
  color: "#333",
  marginBottom: "10px"
};

const subtitleStyle = {
  textAlign: "center",
  color: "#666",
  marginBottom: "30px"
};

const cardStyle = {
  background: "#fff",
  padding: "25px",
  borderRadius: "8px",
  marginBottom: "20px"
};

const labelStyle = {
  display: "block",
  fontWeight: "bold",
  marginBottom: "10px",
  color: "#333"
};

const fileInputStyle = {
  padding: "10px",
  borderRadius: "6px",
  border: "2px dashed #ccc",
  width: "100%",
  cursor: "pointer",
  marginBottom: "15px"
};

const fileSelectedStyle = {
  background: "#e8f5e9",
  padding: "10px",
  borderRadius: "6px",
  marginBottom: "15px",
  color: "#2e7d32"
};

const errorStyle = {
  background: "#ffebee",
  color: "#c62828",
  padding: "15px",
  borderRadius: "8px",
  marginBottom: "20px",
  border: "1px solid #ef5350"
};

const resultCardStyle = {
  background: "#fff",
  padding: "25px",
  borderRadius: "8px"
};

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "15px"
};

const resultTitleStyle = {
  margin: 0,
  color: "#333"
};

const buttonBaseStyle = {
  border: "none",
  padding: "8px 16px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px"
};

const copyButtonStyle = {
  ...buttonBaseStyle,
  background: "#2196F3",
  color: "#fff",
  marginRight: "10px"
};

const downloadButtonStyle = {
  ...buttonBaseStyle,
  background: "#4CAF50",
  color: "#fff"
};

const jsonDisplayStyle = {
  background: "#f5f5f5",
  padding: "15px",
  borderRadius: "6px",
  maxHeight: "500px",
  overflowY: "auto",
  fontFamily: "monospace",
  fontSize: "13px",
  lineHeight: "1.5"
};

const nextStepsStyle = {
  marginTop: "15px",
  padding: "15px",
  background: "#e3f2fd",
  borderRadius: "6px",
  color: "#1565c0"
};

const linkStyle = {
  color: "#2196F3",
  textDecoration: "none",
  fontSize: "14px"
};

export default function ParseResume() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setError("Please select a valid PDF file");
      setFile(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) {
      setError("Please select a PDF file first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse resume");
      }

      setResult(data.data);
    } catch (err) {
      setError(err.message || "Failed to parse resume");
    } finally {
      setLoading(false);
    }
  }, [file]);

  const downloadJSON = useCallback(() => {
    if (!result) return;

    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getFileName(result.name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const copyToClipboard = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    alert("JSON copied to clipboard!");
  }, [result]);

  // Memoize button style based on loading state
  const uploadButtonStyle = useMemo(() => ({
    background: loading ? "#9e9e9e" : "#4CAF50",
    color: "#fff",
    border: "none",
    padding: "12px 28px",
    fontSize: "16px",
    fontWeight: "bold",
    borderRadius: "8px",
    cursor: loading || !file ? "not-allowed" : "pointer",
    width: "100%",
    transition: "background 0.15s",
    opacity: loading || !file ? 0.7 : 1
  }), [loading, file]);

  // Memoize JSON string to avoid re-stringifying on every render
  const jsonString = useMemo(() => {
    return result ? JSON.stringify(result, null, 2) : "";
  }, [result]);

  // Memoize file size display
  const fileSizeDisplay = useMemo(() => {
    return file ? `✓ Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)` : null;
  }, [file]);

  // Memoize filename for next steps
  const resultFileName = useMemo(() => {
    return result ? getFileName(result.name) : "YourName.json";
  }, [result]);

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>
        PDF Resume to JSON Parser
      </h1>
      <p style={subtitleStyle}>
        Upload your resume PDF to generate a structured JSON file
      </p>

      <div style={cardStyle}>
        <label style={labelStyle}>
          Select Resume PDF:
        </label>
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          style={fileInputStyle}
        />

        {file && (
          <div style={fileSelectedStyle}>
            {fileSizeDisplay}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={uploadButtonStyle}
        >
          {loading ? "Parsing Resume..." : "Parse Resume to JSON"}
        </button>
      </div>

      {error && (
        <div style={errorStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={resultCardStyle}>
          <div style={resultHeaderStyle}>
            <h2 style={resultTitleStyle}>
              Generated JSON
            </h2>
            <div>
              <button
                onClick={copyToClipboard}
                style={copyButtonStyle}
              >
                📋 Copy
              </button>
              <button
                onClick={downloadJSON}
                style={downloadButtonStyle}
              >
                💾 Download JSON
              </button>
            </div>
          </div>

          <div style={jsonDisplayStyle}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {jsonString}
            </pre>
          </div>

          <div style={nextStepsStyle}>
            <strong>Next Steps:</strong>
            <ol style={{ marginBottom: 0, paddingLeft: "20px" }}>
              <li>Download the JSON file</li>
              <li>Save it to the <code>resumes/</code> folder as <code>{resultFileName}</code></li>
              <li>Copy the HTML template and save it to <code>templates/</code> folder</li>
              <li>Restart the dev server</li>
              <li>Your resume will appear in the dropdown on the main page!</li>
            </ol>
          </div>
        </div>
      )}

      <div style={{ 
        marginTop: "30px", 
        textAlign: "center" 
      }}>
        <a 
          href="/"
          style={linkStyle}
        >
          ← Back to Resume Generator
        </a>
      </div>
    </div>
  );
}

