package com.satya.mvc

import com.google.common.cache.CacheBuilder
import com.google.common.cache.CacheLoader
import com.google.common.cache.LoadingCache
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestMethod
import org.springframework.web.bind.annotation.RequestParam

import java.util.concurrent.TimeUnit

import static org.jsoup.Jsoup.parse

@Controller
class HtmlPageParsingServiceController {

    LoadingCache cache = CacheBuilder.newBuilder()
            .maximumSize(10000)
            .expireAfterWrite(1, TimeUnit.HOURS)
//            .removalListener(MY_LISTENER)
            .build(
                    new CacheLoader() {
                        def load(param) {
                            return loadWebPage(param)
                        }
                    });

    static loadWebPage(String url) {
        Document doc = Jsoup.connect(url).get();
        return doc
    }

    @RequestMapping(path = "/api/parse/html", method = RequestMethod.GET)
    def parseHtml(@RequestParam String url) {
        cache.get(url).toString()
    }

    def runQuery(){

    }
}
