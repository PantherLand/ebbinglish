import AVFoundation
import Foundation

class AudioPlayer: ObservableObject {
    static let shared = AudioPlayer()

    private var player: AVPlayer?

    func play(url: String) {
        guard let audioURL = URL(string: url) else { return }

        let playerItem = AVPlayerItem(url: audioURL)
        player = AVPlayer(playerItem: playerItem)
        player?.play()
    }

    func stop() {
        player?.pause()
        player = nil
    }
}
