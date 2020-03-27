package com.satya.mvc

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestMethod
import org.springframework.web.bind.annotation.RequestParam

@Controller
class GenericController {
    Properties versionInfo = null;

    @RequestMapping(path = "/api/introspection/build", method = RequestMethod.GET)
    def buildInfo() {
        if(versionInfo == null){
            versionInfo = new Properties()
            versionInfo.load(getClass().classLoader.getResourceAsStream("version.properties"))
        }

        return "${versionInfo.get("major")}.${versionInfo.get("minor")}.${versionInfo.get("build")}"
    }
}
