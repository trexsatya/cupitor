package com.satya.mvc

import com.satya.dao.ArticleRepo
import com.satya.dao.NotepadRepo
import com.satya.domain.Article
import com.satya.services.CounterService
import io.swagger.annotations.ApiImplicitParam
import io.swagger.annotations.ApiImplicitParams
import io.swagger.annotations.ApiOperation
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.*
import org.springframework.beans.factory.annotation.*

import javax.servlet.http.HttpServletRequest

@Controller
@CrossOrigin
@RequestMapping(value = "/api")
class ArticleController {

    class ArticleNotFoundException extends Exception{
        ArticleNotFoundException(){ super("Article Not Found by id.") }
        ArticleNotFoundException(String message){ super(message) }
    }

    @Autowired ArticleRepo articleRepo
    @Autowired NotepadRepo notepadRepo
    @Autowired CounterService counterService

    @RequestMapping(value = "/articles/{subject}", method = RequestMethod.GET)
    def @ResponseBody getArticles(@PathVariable String subject, @RequestParam(required=false) List<String> tags) {

        def resp
        if(!tags){
            resp = articleRepo.findBySubjectLike(subject)
        } else {
            resp = articleRepo.findBySubjectAndTags(subject, tags)
        }

        resp = resp.collect{ article -> article.content = ''; return article; }
        return resp
    }

    @RequestMapping(value = "/article/{id}", method = RequestMethod.GET)
    def @ResponseBody getArticle(@PathVariable Long id) {
        def resp = articleRepo.findOne(id)
        return resp
    }

    @RequestMapping(value = "/search/{searchText}", method = RequestMethod.GET)
    def @ResponseBody searchArticles(@PathVariable String searchText){
        articleRepo.searchArticles(searchText).collect {
             [name: it.name, id: it.id, img: it.img]
        }
    }

    @ApiOperation(notes = "Update An Article", value = "")
    @ApiImplicitParams(
            @ApiImplicitParam(name="X-Auth", required = true)
    )
    @CrossOrigin
    @RequestMapping(value = "/article/{id}", method = RequestMethod.PUT)
    def @ResponseBody updateArticle( @RequestBody Article article, HttpServletRequest request, @PathVariable("id") String id) {
        if(!article.id) throw new ArticleNotFoundException("Id can't be null")

        def resp = articleRepo.findOne(article.id)
        if(resp) resp = articleRepo.save(article)
        else throw new ArticleNotFoundException()

        return resp
    }

    @ApiOperation(notes = "Update An Article", value = "")
    @ApiImplicitParams(
            @ApiImplicitParam(name="X-Auth", required = true)
    )
    @CrossOrigin
    @RequestMapping(value = "/notepad/{id}", method = RequestMethod.POST)
    def @ResponseBody postNotepadNote( @RequestBody String data, HttpServletRequest request,
                                   @PathVariable("id") String id) {
        def resp = notepadRepo.findOne(id)
        if(resp) resp = notepadRepo.save(data)
        else throw new ArticleNotFoundException()

        return resp
    }

    /**
     * POST and PUT, both can be used to create/update resoue
     * PUT is idempotent, if you put same resource twice, it has no effect second time.
     * However Spring Data Rest uses POST to create new resource, and PUT and PATCH to update resource.
     *
     * @param article
     * @param request
     * @return
     */
    @ApiOperation(notes = "Create A New Article", value = "")
    @ApiImplicitParams(
            @ApiImplicitParam(name="X-Auth", required = true)
    )
    @CrossOrigin
    @RequestMapping(value = "/article", method = RequestMethod.POST)
    def @ResponseBody newArticle( @RequestBody Article article,HttpServletRequest request) {
        def resp
        article.id = counterService.getNextSequence("article")
        if( article.id) resp =  articleRepo.findOne(article.id)
        if(!resp) resp = articleRepo.save(article)
        return resp
    }

    @ResponseStatus(HttpStatus.NOT_FOUND)
    @ExceptionHandler(ArticleNotFoundException.class)
    def excpHandler1(ArticleNotFoundException exc){
        return exc.getMessage()
    }

}

