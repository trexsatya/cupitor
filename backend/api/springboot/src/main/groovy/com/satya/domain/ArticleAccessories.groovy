package com.satya.domain

import org.springframework.data.annotation.Id

/**
 * Created by Anoop Singh on 3/25/2017.
 */
class ArticleAccessories {
    @Id
    String key

    Map<String,String> speechTexts;
    Map<String,String> animationScripts;
}
