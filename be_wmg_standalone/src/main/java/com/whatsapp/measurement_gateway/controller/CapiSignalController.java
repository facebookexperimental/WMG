package com.whatsapp.measurement_gateway.controller;

import com.whatsapp.measurement_gateway.data.CapiSignal;
import com.whatsapp.measurement_gateway.repository.CapiSignalRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.domain.Sort.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CapiSignalController {
  Logger logger = LoggerFactory.getLogger(CapiSignalController.class);

  @Autowired private final CapiSignalRepository capiSignalRepository;

  @Autowired
  public CapiSignalController(CapiSignalRepository capiSignalRepository) {
    this.capiSignalRepository = capiSignalRepository;
  }

  public Direction getSortDirection(String direction) {
    return direction.contains("desc") ? Direction.DESC : Direction.ASC;
  }

  @GetMapping("/capi_events")
  public ResponseEntity<?> findAllKeywords(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "id,desc") String[] sort) {

    try {
      List<Order> orders = new ArrayList<>();
      if (sort.length > 2) {
        return new ResponseEntity<>(
            "Sort parameter should have a field followed by a direction", HttpStatus.BAD_REQUEST);
      } else {
        orders.add(new Order(getSortDirection(sort[1]), sort[0]));
      }

      List<CapiSignal> capiSignals = new ArrayList<>();
      Pageable pagingSort = PageRequest.of(page, size, Sort.by(orders));

      Page<CapiSignal> pageCapeCapiSignals = capiSignalRepository.findAll(pagingSort);

      capiSignals = pageCapeCapiSignals.getContent();

      if (capiSignals.isEmpty()) {
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
      }

      Map<String, Object> response = new HashMap<>();
      response.put("capiSignals", capiSignals);
      response.put("currentPage", pageCapeCapiSignals.getNumber());
      response.put("totalItems", pageCapeCapiSignals.getTotalElements());
      response.put("totalPages", pageCapeCapiSignals.getTotalPages());

      return new ResponseEntity<>(response, HttpStatus.OK);
    } catch (Exception e) {

      logger.error(e.getMessage(), e);
      return new ResponseEntity<>(null, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
