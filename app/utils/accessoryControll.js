const log = require('electron-log')
const http = require('http')

class PhilipsHueController {
  constructor (address, key) {
    this.key = key
    this.address = address
  }

  setScene (scene) {
    for (const lightId in scene) {
      const light = scene[lightId]
      const r = http.request(
        {
          hostname: this.address,
          path: '/api/' + this.key + '/lights/' + light.id + '/state',
          port: 80,
          method: 'PUT'
        },
        (res) => {
          console.log(`STATUS: ${res.statusCode}`)
          console.log(`HEADERS: ${JSON.stringify(res.headers)}`)
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`)
          })
          res.on('end', () => {
            console.log('No more data in response.')
          })
        }
      )
      r.on('error', (e) => {
        console.error(`problem with request: ${e.message}`)
      })
      r.write(light.state)
      r.end()
    }
  }
}

class AccessoryControll {
  constructor (settings) {
    if (!settings) {
      settings = {}
    }
    this.systems = {}
    this.loadSystems(settings.systems)
    this.scenes = settings.scenes
  }

  loadSystems (systems) {
    systems.forEach((system) => {
      switch (system.type) {
        case 'hue':
          this.systems[system.id] = new PhilipsHueController(
            system.address,
            system.key
          )
          break
        default:
          log.warn('AccessoryControll > Unknow surce type ' + system.type)
          break
      }
    })
  }

  onBreak (mikro) {
    if (mikro) {
      log.info('AccessoryControll > Mikrobreak starts')
    } else {
      log.info('AccessoryControll > Break starts')
    }

    const sceneId = 'main'

    for (const systemId in this.systems) {
      const systemScene = this.scenes[sceneId][systemId]
      const system = this.systems[systemId]
      system.setScene(systemScene)
    }
  }

  onBreakEnd () {
    log.info('AccessoryControll > Break ends')
  }
}

module.exports = AccessoryControll
