import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';

import { MatTable, MatTableDataSource, MatPaginator, MatSort } from '@angular/material';

@Component({
  selector: 'app-events-view',
  templateUrl: './events-view.component.html',
  styleUrls: ['./events-view.component.css']
})
export class EventsViewComponent implements OnInit, AfterViewInit {

  displayColumns = ['ontime', 'text', 'type', 'group', 'status'];

  dataSource = new MatTableDataSource([]);
  @ViewChild(MatTable) table: MatTable<any>;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor() { }

  ngOnInit() {
  }

  ngAfterViewInit() {
  }
}
