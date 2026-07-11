import Foundation
import Speech
import AVFoundation

/// Live dictation for the Dreams screen: streams the mic through
/// SFSpeechRecognizer with partial results, so words appear in the box as you
/// speak (not just at the end). `transcript` updates continuously; the view
/// mirrors it into the text field.
final class DreamSpeech: ObservableObject {
    @Published var transcript = ""
    @Published var recording = false
    @Published var errorText: String?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var base = ""   // whatever was already typed before this recording

    func toggle(seed: String) { recording ? stop() : start(seed: seed) }

    private func onMain(_ block: @escaping () -> Void) { DispatchQueue.main.async(execute: block) }

    private func start(seed: String) {
        base = seed.isEmpty ? "" : seed + " "
        onMain { self.transcript = seed }
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                self.onMain { self.errorText = "Turn on Speech Recognition in Settings to dictate your dream." }
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else {
                    self.onMain { self.errorText = "Turn on Microphone access in Settings to record your dream." }
                    return
                }
                self.onMain { self.begin() }
            }
        }
    }

    private func begin() {
        guard let recognizer, recognizer.isAvailable else {
            errorText = "Dictation isn't available right now."
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            request = req

            let input = engine.inputNode
            input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buffer, _ in
                self?.request?.append(buffer)
            }
            engine.prepare()
            try engine.start()
            recording = true

            task = recognizer.recognitionTask(with: req) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    let text = self.base + result.bestTranscription.formattedString
                    self.onMain { self.transcript = text }
                }
                if error != nil || (result?.isFinal ?? false) {
                    self.onMain { self.stop() }
                }
            }
        } catch {
            errorText = "Couldn't start recording."
            stop()
        }
    }

    func stop() {
        if engine.isRunning {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        recording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
