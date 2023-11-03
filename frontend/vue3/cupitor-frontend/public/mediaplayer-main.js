function populateSpeeds() {
  window.playingSpeeds = ['0.75', '1.00', '1.00']
}

populateSpeeds()

window.player = new MediaElementPlayer('audio-player', {
  iconSprite: '/img/icons/mejs-controls.svg',
  defaultSpeed: 0.75,
  speeds: ['0.50', '0.75', '1.00', '0.75'],
  features: ['playpause','speed','current','progress','duration', 'loop'],
  success: function (mediaElement, originalNode, instance) {
    mediaElement.addEventListener('ended',  e => {
      const newSpeed = window.playingSpeeds.shift()
      if(newSpeed) {
        mediaElement.playbackRate = newSpeed
        delay(1000).then(() => window.player.play())
      }
    })
    // do things
  }
})
window.player.setPlayerSize(300, 50)
