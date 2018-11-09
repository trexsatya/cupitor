package com.satya.domain

import org.springframework.data.annotation.Id;

class Article{
     String name
     @Id Long id
     String content
     Long authorId
     String subject
     List<String> tags
     String img
     String summary
     Date lastUpdated
}

