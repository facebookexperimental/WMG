package com.whatsapp.measurement_gateway.controller;

import com.whatsapp.measurement_gateway.data.KeywordMapping;
import com.whatsapp.measurement_gateway.repository.KeywordRepository;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class KeywordsController {

  private final KeywordRepository keywordRepository;

  @Autowired
  public KeywordsController(KeywordRepository KeywordsController) {
    this.keywordRepository = KeywordsController;
  }

  @GetMapping("/keywords")
  public Iterable<KeywordMapping> findAllKeywords() {
    return this.keywordRepository.findAll();
  }

  @PostMapping("/keywords")
  public KeywordMapping addOneKeyword(@RequestBody KeywordMapping keywordMapping) {
    keywordMapping.setId(null);
    return this.keywordRepository.save(keywordMapping);
  }

  @PutMapping("/keywords/{id}")
  public ResponseEntity<KeywordMapping> updateKeyword(
      @RequestBody KeywordMapping keywordMapping, @PathVariable("id") Integer id) {
    keywordMapping.setId(id);

    if (this.keywordRepository.existsById(id)) {
      return new ResponseEntity<>(this.keywordRepository.save(keywordMapping), HttpStatus.ACCEPTED);
    }

    return new ResponseEntity<>(HttpStatus.NOT_FOUND);
  }

  @GetMapping("/keywords/{id}")
  public ResponseEntity<KeywordMapping> findKeywordById(@PathVariable("id") Integer id) {
    Optional<KeywordMapping> result = this.keywordRepository.findById(id);

    if (result.isPresent()) {
      return new ResponseEntity<>(result.get(), HttpStatus.OK);
    } else {
      return new ResponseEntity<>(HttpStatus.NOT_FOUND);
    }
  }
}
