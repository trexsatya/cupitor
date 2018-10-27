package com.satya.dao


import com.satya.domain.ArticleAccessories
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.data.rest.core.annotation.RepositoryRestResource;
import org.springframework.data.annotation.Id
import org.springframework.security.access.annotation.Secured
import org.springframework.security.access.prepost.*

class NotepadData {
    @Id
    String key
    String name
    String data
    String author
    Map<String,String> meta
}

@Secured("ROLE_ADMIN")
@RepositoryRestResource(collectionResourceRel = "notepadData", path = "notepadData")
interface NotepadRepo extends MongoRepository<NotepadData,String> {

}
