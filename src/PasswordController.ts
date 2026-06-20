import { useState, useEffect } from "react";
import { calcoloRobustezza, Strength } from "./strengthModel";

const INITIAL_STRENGTH: Strength = {
  baseScore: 0,
  score: 0,
  label: "Inizia a digitare…",
  color: "#2d7dff",
  suggestions: [],
  patterns:    [],
};

export function usePasswordController() {
  // Stati interni del Controller
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Stato per il risultato
  const [strength, updateUI] = useState<Strength>(INITIAL_STRENGTH);
  // Stato per il caricamento (check API in corso)
  const [isCheckingLocal, setIsCheckingLocal]   = useState(false);
  const [isCheckingOnline, setIsCheckingOnline] = useState(false);

  useEffect(() => {
    // Debounce: non chiamare API ad ogni tasto, aspetta che l'utente si fermi un attimo
    
    const timer = setTimeout(async () => {
      if (!password) {
        updateUI(INITIAL_STRENGTH);
        return;
      }

      setIsCheckingLocal(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      setIsCheckingLocal(false);
      setIsCheckingOnline(true);
      try {
        const result = await calcoloRobustezza(password);
        updateUI(result);
      } catch (error) {
        console.error(error);
      } finally {
        setIsCheckingOnline(false);
      }
    }, 500);  // 500 ms di ritardo

    return () => clearTimeout(timer); // Cleanup se l'utente digita ancora
  }, [password]);

  // Gestisce toggle visibilità password
  const handleToggleVisibility = () => {
    setShowPassword((prev) => !prev);
  };
  
  // Gestisce input dell'utente dalla View
  const [validationError, setValidationError] = useState(false);

  const handlePasswordChange = (newPassword: string) => {
  // NIST sezione 3.1.1 SHOULD: accetta Unicode e spazio, vieta solo caratteri di controllo
  const hasInvalidChars = /[\x00-\x1F\x7F]/.test(newPassword);
  
  if (hasInvalidChars && newPassword !== "") {
    setValidationError(true);
    setTimeout(() => setValidationError(false), 2000);
    return; // NON aggiorna password
  }
  
  setPassword(newPassword);
  setValidationError(false);
  };

  // API pubblica del Controller per la View
  return {
    // Stato da visualizzare
    password,
    showPassword,
    strength,
    isCheckingLocal,
    isCheckingOnline,
    validationError,
    // Azioni disponibili
    richiestaAnalisiPassword: handlePasswordChange,
    onToggleVisibility: handleToggleVisibility,
    patterns: strength.patterns,
    modification: strength.modification,
  };
}

