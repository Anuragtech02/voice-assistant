// Pickle Voice Assistant JavaScript

document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const startRecordingButton = document.getElementById("startRecording");
  const recordingStatus = document.getElementById("recordingStatus");
  const messageContainer = document.getElementById("messageContainer");
  const modelSelect = document.getElementById("model-select");
  const enableTTS = document.getElementById("enableTTS");
  const ttsSettings = document.getElementById("ttsSettings");
  const ttsRate = document.getElementById("tts-rate");
  const ttsPitch = document.getElementById("tts-pitch");
  const ttsVoice = document.getElementById("tts-voice");
  const ttsRateValue = document.getElementById("tts-rate-value");
  const ttsPitchValue = document.getElementById("tts-pitch-value");
  const textInput = document.getElementById("textInput");
  const sendButton = document.getElementById("sendButton");
  const messageForm = document.getElementById("messageForm");

  // Initialize Web Speech API for Speech Recognition
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  let usingSpeechRecognition = true;
  let recognition;

  if (!SpeechRecognition) {
    recordingStatus.textContent =
      "Speech recognition not supported in this browser";
    startRecordingButton.disabled = true;
    usingSpeechRecognition = false;
  } else {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
  }

  // Initialize Web Speech API for Speech Synthesis (as fallback)
  const speechSynthesis = window.speechSynthesis;
  let voices = [];
  let currentlySpeaking = null;
  let isSpeaking = false;

  // TTS settings event listeners
  ttsRate.addEventListener("input", () => {
    ttsRateValue.textContent = parseFloat(ttsRate.value).toFixed(1);
  });

  ttsPitch.addEventListener("input", () => {
    ttsPitchValue.textContent = parseFloat(ttsPitch.value).toFixed(1);
  });

  enableTTS.addEventListener("change", () => {
    ttsSettings.style.display = enableTTS.checked ? "flex" : "none";
  });

  // Server proxy endpoint - Replace with your actual deployed server URL
  const SERVER_PROXY_URL = "https://nuc-backend.inspectionapp.in/api/chat";

  // Kokoro TTS API endpoints
  const KOKORO_VOICES_URL =
    "https://nuc-voice.inspectionapp.in/v1/audio/voices";
  const KOKORO_SPEECH_URL =
    "https://nuc-voice.inspectionapp.in/v1/audio/speech";

  // State variables
  let isRecording = false;
  let currentTranscript = "";
  let finalTranscript = "";
  let processingAI = false;

  // For handling reconnection
  let reconnectionAttempts = 0;
  const MAX_RECONNECTION_ATTEMPTS = 3;

  // For handling network errors
  let networkErrorCount = 0;
  const MAX_NETWORK_ERRORS = 3;

  // Add welcome message
  addBotMessage(
    "Hello! I'm Pickle, your friendly assistant. How can I help you today? Tap the microphone button to speak, or type your message below.",
    modelSelect.value
  );

  // Initialize Kokoro voices
  initKokoroVoices();

  // Event handler for text input form submission
  messageForm.addEventListener("submit", function (e) {
    // Always prevent the default form submission
    e.preventDefault();

    // Get the message
    const message = textInput.value.trim();

    // Only process if we have a message and aren't already processing
    if (message && !processingAI) {
      // Clear the input
      textInput.value = "";

      // Process the message
      processTranscript(message);
    }
  });

  // Event handlers for recording button
  startRecordingButton.addEventListener("mousedown", startRecording);
  startRecordingButton.addEventListener("touchstart", startRecording);
  startRecordingButton.addEventListener("mouseup", stopRecording);
  startRecordingButton.addEventListener("touchend", stopRecording);
  startRecordingButton.addEventListener("mouseleave", stopRecording);

  // Model selection change event
  modelSelect.addEventListener("change", function () {
    addBotMessage(
      `Switched to ${
        modelSelect.options[modelSelect.selectedIndex].text
      }. How can I help you?`,
      modelSelect.value
    );
  });

  // Functions for recording
  function startRecording(e) {
    e.preventDefault();

    if (isRecording || processingAI || !usingSpeechRecognition) return;

    // Check for network connectivity
    if (!navigator.onLine) {
      recordingStatus.textContent =
        "No internet connection. Please check your network.";
      return;
    }

    isRecording = true;
    finalTranscript = "";
    currentTranscript = "";

    try {
      recognition.start();
      startRecordingButton.classList.add("active");
      startRecordingButton.querySelector(".button-text").textContent =
        "Listening...";
      recordingStatus.textContent = "Listening...";

      // Safety timeout - automatically stop after 15 seconds to prevent hanging
      setTimeout(() => {
        if (isRecording) {
          stopRecording({ preventDefault: () => {} });
        }
      }, 15000);
    } catch (error) {
      console.error("Error starting recognition:", error);
      recordingStatus.textContent =
        "Error starting speech recognition. Please try again.";
      isRecording = false;
    }
  }

  function stopRecording(e) {
    if (e) e.preventDefault();

    if (!isRecording || !usingSpeechRecognition) return;

    isRecording = false;
    recognition.stop();
    startRecordingButton.classList.remove("active");
    startRecordingButton.querySelector(".button-text").textContent =
      "Hold to speak";

    if (finalTranscript.trim()) {
      processTranscript(finalTranscript);
    } else if (currentTranscript.trim()) {
      processTranscript(currentTranscript);
    } else {
      recordingStatus.textContent = "Tap microphone to start";
    }
  }

  // Recognition event handlers
  if (usingSpeechRecognition) {
    recognition.onresult = function (event) {
      currentTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          currentTranscript += event.results[i][0].transcript;
        }
      }

      if (currentTranscript) {
        recordingStatus.textContent = "Hearing: " + currentTranscript;
      }
    };

    recognition.onerror = function (event) {
      console.error("Recognition error:", event.error);

      // Handle specific error types
      if (event.error === "network") {
        networkErrorCount++;
        console.log(
          `Network error detected (${networkErrorCount}/${MAX_NETWORK_ERRORS}). Attempting to reconnect...`
        );

        if (networkErrorCount >= MAX_NETWORK_ERRORS) {
          // Switch to text input fallback after too many network errors
          recordingStatus.textContent =
            "Speech recognition unavailable. Please use text input.";
          isRecording = false;
          startRecordingButton.classList.remove("active");
          startRecordingButton.disabled = true;
          startRecordingButton.style.opacity = "0.5";
          startRecordingButton.querySelector(".button-text").textContent =
            "Voice unavailable";

          // Add message to inform the user
          addBotMessage(
            "I'm having trouble connecting to the speech recognition service. Please use the text input instead.",
            modelSelect.value
          );
          return;
        }

        recordingStatus.textContent = `Network issue detected. Reconnecting... (${networkErrorCount}/${MAX_NETWORK_ERRORS})`;

        // Wait a moment and try to restart
        setTimeout(() => {
          try {
            if (isRecording) {
              recognition.stop();
              setTimeout(() => {
                recognition.start();
                recordingStatus.textContent = "Reconnected. Listening...";
              }, 300);
            }
          } catch (e) {
            console.error("Failed to restart after network error:", e);
            recordingStatus.textContent =
              "Could not reconnect. Please try again.";
            isRecording = false;
            startRecordingButton.classList.remove("active");
            startRecordingButton.querySelector(".button-text").textContent =
              "Hold to speak";
          }
        }, 1000);
      } else if (event.error === "no-speech") {
        // This is common and not critical
        recordingStatus.textContent = "No speech detected. Please try again.";
        // Reset network error count on non-network errors
        networkErrorCount = 0;
      } else if (event.error === "aborted") {
        recordingStatus.textContent = "Listening was aborted.";
        networkErrorCount = 0;
      } else if (event.error === "audio-capture") {
        recordingStatus.textContent =
          "Could not capture audio. Please check your microphone.";
        addBotMessage(
          "I'm having trouble accessing your microphone. You can type your messages below instead.",
          modelSelect.value
        );
        networkErrorCount = 0;
      } else if (event.error === "not-allowed") {
        recordingStatus.textContent =
          "Microphone access denied. Please allow microphone access.";
        addBotMessage(
          "I don't have permission to access your microphone. You can type your messages below instead.",
          modelSelect.value
        );
        networkErrorCount = 0;
      } else {
        // Handle other errors
        recordingStatus.textContent = "Error: " + event.error;
        networkErrorCount = 0;
      }

      // Only stop recording if it's a critical error
      if (event.error !== "network" && event.error !== "no-speech") {
        isRecording = false;
        startRecordingButton.classList.remove("active");
        startRecordingButton.querySelector(".button-text").textContent =
          "Hold to speak";
      }
    };

    recognition.onend = function () {
      if (isRecording) {
        // Only attempt to restart a limited number of times
        if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
          reconnectionAttempts++;
          recordingStatus.textContent = `Reconnecting... (Attempt ${reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS})`;

          // Add a small delay before restarting
          setTimeout(() => {
            try {
              recognition.start();
            } catch (error) {
              console.error("Error restarting recognition:", error);
              recordingStatus.textContent =
                "Failed to reconnect. Please try again.";
              isRecording = false;
              startRecordingButton.classList.remove("active");
              startRecordingButton.querySelector(".button-text").textContent =
                "Hold to speak";
            }
          }, 300);
        } else {
          // Max reconnection attempts reached
          recordingStatus.textContent =
            "Connection issues detected. Please try again.";
          isRecording = false;
          startRecordingButton.classList.remove("active");
          startRecordingButton.querySelector(".button-text").textContent =
            "Hold to speak";
          reconnectionAttempts = 0; // Reset for next time
        }
      } else {
        // Reset reconnection attempts when we're done
        reconnectionAttempts = 0;
      }
    };
  }

  // Initialize Kokoro voices
  async function initKokoroVoices() {
    try {
      const response = await fetch(KOKORO_VOICES_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      // Clear the voice dropdown
      ttsVoice.innerHTML = "";

      if (data && data.voices && data.voices.length > 0) {
        // Add each Kokoro voice to the dropdown
        data.voices.forEach((voiceId) => {
          const option = document.createElement("option");
          option.value = voiceId;
          option.textContent = voiceId;
          ttsVoice.appendChild(option);
        });

        console.log("Successfully loaded Kokoro voices");
      } else {
        // Fallback to browser voices if no Kokoro voices are found
        console.warn("No Kokoro voices found, falling back to browser voices");
        loadBrowserVoices();
      }
    } catch (error) {
      console.error("Error loading Kokoro voices:", error);
      // Fallback to browser voices
      loadBrowserVoices();
    }
  }

  // Fallback to load browser voices
  function loadBrowserVoices() {
    voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = function () {
          voices = speechSynthesis.getVoices();
          populateBrowserVoices();
        };
      }
    } else {
      populateBrowserVoices();
    }
  }

  function populateBrowserVoices() {
    // Clear current options
    ttsVoice.innerHTML = "";

    // Add browser voices
    voices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = "browser:" + index;
      option.textContent = voice.name;
      ttsVoice.appendChild(option);

      // Select default voice
      if (voice.default) {
        ttsVoice.value = "browser:" + index;
      }
    });
  }

  // Process the transcript and call AI API via server proxy
  function processTranscript(transcript) {
    if (!transcript.trim() || processingAI) return;

    processingAI = true;
    const cleanTranscript = transcript.trim();
    addUserMessage(cleanTranscript);
    recordingStatus.textContent = "Processing...";

    // Show typing indicator
    addTypingIndicator();

    // Get the selected model
    const selectedModel = modelSelect.value;

    // Call the server proxy
    callServerProxy(cleanTranscript, selectedModel)
      .then((response) => {
        // Remove typing indicator
        removeTypingIndicator();

        if (response) {
          // Add the bot message and speak it if TTS is enabled
          addBotMessage(response.response, response.model);

          // If text-to-speech is enabled, speak the response
          if (enableTTS.checked) {
            speakText(response.response);
          }
        } else {
          addBotMessage(
            "I'm sorry, I couldn't process that request. Please try again.",
            selectedModel
          );
        }
        processingAI = false;
        recordingStatus.textContent = "Tap microphone to start";
      })
      .catch((error) => {
        console.error("Error calling server proxy:", error);
        removeTypingIndicator();
        addBotMessage(
          "I'm sorry, there was an error processing your request. Please try again later.",
          selectedModel
        );
        processingAI = false;
        recordingStatus.textContent = "Error. Please try again.";
      });
  }

  // Call Server Proxy
  async function callServerProxy(message, model) {
    try {
      const response = await fetch(SERVER_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, model }),
      });

      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error in callServerProxy:", error);
      throw error;
    }
  }

  // Text-to-Speech Function using Kokoro or Browser Fallback
  function speakText(message, resumeFromPause = false) {
    // Cancel any existing speech
    if (currentlySpeaking && currentlySpeaking.audio) {
      currentlySpeaking.audio.pause();
      currentlySpeaking.audio = null;

      // Reset all play buttons first
      document.querySelectorAll(".tts-play-button").forEach((button) => {
        button.classList.remove("speaking");
        button.innerHTML =
          '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      });
    }

    // Find the play button for this message
    const playButton = Array.from(
      document.querySelectorAll(".tts-play-button")
    ).find((button) => button.dataset.text === message);

    // Get the currently selected voice value from the dropdown
    const selectedVoiceValue = ttsVoice.value;

    // Decide which TTS engine to use based on the selected voice value
    if (selectedVoiceValue && selectedVoiceValue.startsWith("browser:")) {
      // If it's a browser voice, use the built-in TTS directly
      console.log(
        "Using browser's built-in TTS for voice:",
        selectedVoiceValue
      );

      // Update UI immediately for browser TTS (since it's synchronous)
      if (playButton) {
        playButton.classList.add("speaking");
        playButton.innerHTML =
          '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      }
      currentlySpeaking = {
        messageText: message,
        type: "browser",
      }; // Mark type
      isSpeaking = true;

      fallbackToBuiltInTTS(message, playButton); // Pass playButton to handle UI update on end
    } else if (selectedVoiceValue) {
      // Otherwise, assume it's a Kokoro voice and try the API
      console.log("Using Kokoro TTS API for voice:", selectedVoiceValue);

      if (playButton) {
        playButton.classList.add("speaking");
        playButton.innerHTML =
          '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      }

      currentlySpeaking = {
        messageText: message,
        type: "kokoro",
      }; // Mark type
      isSpeaking = true;

      callKokoroTTS(message, selectedVoiceValue) // Pass selected voice explicitly
        .then((audioBlob) => {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          currentlySpeaking.audio = audio; // Store audio element

          audio.onended = function () {
            if (playButton) {
              playButton.classList.remove("speaking");
              playButton.innerHTML =
                '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
            }
            if (
              currentlySpeaking &&
              currentlySpeaking.messageText === message
            ) {
              currentlySpeaking = null;
              isSpeaking = false;
            }
            URL.revokeObjectURL(audioUrl);
          };
          audio.play();
        })
        .catch((error) => {
          // Handle errors *during* the Kokoro API call itself
          console.error("Error generating speech with Kokoro:", error);
          if (playButton) {
            playButton.classList.remove("speaking");
            playButton.innerHTML =
              '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
          }
          // Maybe add a message to the user that TTS failed for this message
          if (currentlySpeaking && currentlySpeaking.messageText === message) {
            currentlySpeaking = null;
            isSpeaking = false;
          }
        });
    } else {
      // Handle case where no voice is selected at all (dropdown empty?)
      console.warn("No TTS voice selected.");
      if (playButton) {
        playButton.classList.remove("speaking"); // Ensure button is reset
        playButton.innerHTML =
          '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      }
    }
  }

  // Function to call Kokoro TTS API
  async function callKokoroTTS(text, selectedVoice) {
    try {
      const response = await fetch(KOKORO_SPEECH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "kokoro",
          input: text,
          voice: selectedVoice,
          response_format: "mp3",
          speed: parseFloat(ttsRate.value),
          stream: true,
          return_download_link: false,
          lang_code: "a",
          normalization_options: {
            normalize: true,
            unit_normalization: false,
            url_normalization: true,
            email_normalization: true,
            optional_pluralization_normalization: true,
          },
        }),
      });

      if (!response.ok) {
        let errorBody = "Could not retrieve error details.";
        try {
          errorBody = await response.text();
        } catch (e) {}
        console.error("Kokoro TTS API Error Body:", errorBody);
        throw new Error(`HTTP error! Status: ${response.status}. ${errorBody}`);
      }

      // The API returns the audio file directly
      return await response.blob();
    } catch (error) {
      console.error("Error calling Kokoro TTS API:", error);
      throw error; // Re-throw to be caught by speakText
    }
  }

  // Fallback to browser's built-in TTS
  function fallbackToBuiltInTTS(message, playButton) {
    console.log("Falling back to browser's built-in TTS");

    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(message);

    // Set utterance properties
    utterance.rate = parseFloat(ttsRate.value);
    utterance.pitch = parseFloat(ttsPitch.value);

    // Set voice if available
    if (voices.length > 0) {
      // Make sure voices are loaded if needed
      if (voices.length === 0) {
        voices = speechSynthesis.getVoices();
      }

      const selectedVoiceValue = ttsVoice.value;
      if (selectedVoiceValue && selectedVoiceValue.startsWith("browser:")) {
        const selectedIndex = parseInt(
          selectedVoiceValue.replace("browser:", "")
        );
        if (
          !isNaN(selectedIndex) &&
          selectedIndex >= 0 &&
          selectedIndex < voices.length
        ) {
          utterance.voice = voices[selectedIndex];
        } else {
          console.warn("Invalid browser voice index:", selectedIndex);
        }
      }
    }

    // Handle end of speech for UI update
    utterance.onend = function () {
      console.log("Browser TTS finished.");
      if (playButton) {
        playButton.classList.remove("speaking");
        playButton.innerHTML =
          '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      }
      if (currentlySpeaking && currentlySpeaking.messageText === message) {
        currentlySpeaking = null;
        isSpeaking = false;
      }
    };

    // Handle errors during speech
    utterance.onerror = function (event) {
      console.error("Browser SpeechSynthesis Error:", event.error);
      if (playButton) {
        playButton.classList.remove("speaking");
        playButton.innerHTML =
          '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      }
      if (currentlySpeaking && currentlySpeaking.messageText === message) {
        currentlySpeaking = null;
        isSpeaking = false;
      }
    };

    // Speak the text
    speechSynthesis.speak(utterance);
  }

  function toggleSpeaking(messageText, button) {
    // If the message is different from what's currently playing OR type is different
    if (
      !currentlySpeaking || // Nothing is playing
      currentlySpeaking.messageText !== messageText || // Different message
      (currentlySpeaking.type === "browser" &&
        !ttsVoice.value.startsWith("browser:")) || // Switched from browser to kokoro
      (currentlySpeaking.type === "kokoro" &&
        ttsVoice.value.startsWith("browser:")) // Switched from kokoro to browser
    ) {
      // Stop current speech if any
      if (currentlySpeaking && currentlySpeaking.audio) {
        // Kokoro audio
        currentlySpeaking.audio.pause();
        currentlySpeaking.audio = null;
      } else if (currentlySpeaking && currentlySpeaking.type === "browser") {
        // Browser speech
        speechSynthesis.cancel();
      }

      // Reset all buttons first
      document.querySelectorAll(".tts-play-button").forEach((btn) => {
        btn.classList.remove("speaking");
        btn.innerHTML =
          '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      });

      // Start new speech (speakText handles deciding Kokoro vs Browser)
      speakText(messageText);
      return;
    }

    // Handle play/pause for the *same* message and *same* type
    if (currentlySpeaking.type === "kokoro" && currentlySpeaking.audio) {
      if (currentlySpeaking.audio.paused) {
        // Resume Kokoro speech
        currentlySpeaking.audio.play();
        button.classList.add("speaking");
        button.innerHTML =
          '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      } else {
        // Pause Kokoro speech
        currentlySpeaking.audio.pause();
        button.classList.remove("speaking");
        button.innerHTML =
          '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      }
    } else if (currentlySpeaking.type === "browser") {
      // Handle play/pause for browser speech
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
        button.classList.add("speaking");
        button.innerHTML =
          '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      } else if (speechSynthesis.speaking) {
        speechSynthesis.pause();
        button.classList.remove("speaking");
        button.innerHTML =
          '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      } else {
        // If not speaking/paused (e.g., finished), start again
        speakText(messageText);
      }
    } else {
      // Fallback: If state is unclear, just start new speech
      speakText(messageText);
    }
  }

  // UI Helper Functions
  function addUserMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.className = "message user-message";
    messageElement.textContent = message;
    messageContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function addBotMessage(message, model) {
    const messageElement = document.createElement("div");
    messageElement.className = "message bot-message";
    messageElement.textContent = message;

    // Add model indicator
    const modelIndicator = document.createElement("div");
    modelIndicator.className = "message-model";
    modelIndicator.textContent = model === "gemini" ? "Gemini" : "ChatGPT";
    messageElement.appendChild(modelIndicator);

    // Add TTS play button if TTS is enabled
    if (enableTTS.checked) {
      const playButton = document.createElement("div");
      playButton.className = "tts-play-button";
      playButton.innerHTML =
        '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>';
      playButton.dataset.text = message;

      // Add click event to play/pause speech
      playButton.addEventListener("click", function () {
        toggleSpeaking(message, this);
      });

      messageElement.appendChild(playButton);
    }

    messageContainer.appendChild(messageElement);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.id = "typingIndicator";

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      indicator.appendChild(dot);
    }

    messageContainer.appendChild(indicator);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) {
      indicator.remove();
    }
  }

  function scrollToBottom() {
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }
});
