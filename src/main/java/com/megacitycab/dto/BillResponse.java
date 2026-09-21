package com.megacitycab.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.megacitycab.model.Bill;

public class BillResponse {

    private final Long id;
    private final String orderNo;
    private final BigDecimal subtotal;
    private final BigDecimal taxAmount;
    private final BigDecimal discountAmount;
    private final BigDecimal totalAmount;
    private final LocalDate issuedDate;

    public BillResponse(Bill bill) {
        this.id = bill.getId();
        this.orderNo = bill.getBooking().getOrderNo();
        this.subtotal = bill.getSubtotal();
        this.taxAmount = bill.getTaxAmount();
        this.discountAmount = bill.getDiscountAmount();
        this.totalAmount = bill.getTotalAmount();
        this.issuedDate = bill.getIssuedDate();
    }

    public Long getId() {
        return id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public LocalDate getIssuedDate() {
        return issuedDate;
    }
}
