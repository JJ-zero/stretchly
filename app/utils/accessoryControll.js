const log = require('electron-log')
const http = require('http')

class PhilipsHueController {
  constructor (address, key) {
    this.key = key
    this.address = address
    this.sceneBackup = {}
  }

  backupState (scene) {
    log.info('AccessoryControll > Backing up light setting')
    for (const lightId in scene) {
      const light = scene[lightId]
      // console.log(light.id)
      http.get(
        'http://' + this.address + '/api/' + this.key + '/lights/' + light.id,
        (res) => {
          res.setEncoding('utf8')
          res.on('data', (rawData) => {
            const data = JSON.parse(rawData)
            const state = data.state
            if (state !== undefined) {
              delete state.alert
              delete state.mode
              delete state.reachable
              delete state.colormode
              this.sceneBackup[lightId] = { id: light.id, state }
            }
          })
        }
      )
    }
    // console.log(this.sceneBackup)
  }

  restoreBackupState () {
    log.info('AccessoryControll > Restoring scene.')
    console.log(this.sceneBackup)
    this.setScene(this.sceneBackup)
    this.sceneBackup = {}
  }

  setScene (scene) {
    log.info('AccessoryControll > Setting scene')
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
          // console.log(`STATUS: ${res.statusCode}`)
          // console.log(`HEADERS: ${JSON.stringify(res.headers)}`)
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            // console.log(`BODY: ${chunk}`)
          })
          res.on('end', () => {
            // console.log('No more data in response.')
          })
        }
      )
      r.on('error', (e) => {
        log.error(`AccessoryControll > Problem with Hue request: ${e.message}`)
      })
      r.write(JSON.stringify(light.state))
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
    this.defaultBreak = settings.defaultSceneMiniBreak
    this.defaultMiniBreak = settings.defaultSceneBreak
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
    let sceneId = null
    if (mikro) {
      sceneId = this.defaultMiniBreak
      log.info('AccessoryControll > Mikrobreak starts')
    } else {
      sceneId = this.defaultBreak
      log.info('AccessoryControll > Break starts')
    }

    if (sceneId == null) {
      return
    }

    for (const systemId in this.systems) {
      const systemScene = this.scenes[sceneId][systemId]
      const system = this.systems[systemId]
      system.backupState(systemScene)
      system.setScene(systemScene)
    }
  }

  onBreakEnd () {
    log.info('AccessoryControll > Break ends')
    for (const systemId in this.systems) {
      const system = this.systems[systemId]
      system.restoreBackupState()
    }
  }
}

module.exports = AccessoryControll
