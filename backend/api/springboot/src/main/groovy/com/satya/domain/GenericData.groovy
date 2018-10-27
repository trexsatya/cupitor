package com.satya.domain

import org.springframework.data.annotation.Id

/**
 * Created by Anoop Singh on 3/25/2017.
 */
class GenericData {
    @Id
    String key

    String content
    String contentType
    String category
}
