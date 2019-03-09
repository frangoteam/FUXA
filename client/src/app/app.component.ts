import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit, AfterViewInit {
  title = 'app';
  location: Location;

  @ViewChild('fabmenu')fabmenu: any; 

  constructor(private router: Router, location: Location) {
    this.location = location;
  }

  ngOnInit() {
  }

  ngAfterViewInit() {
  }

  isHidden() {
    let list = ['/lab'],
      route = this.location.path();
    return (list.indexOf(route) > -1);
  }

  onGoTo(goto) {
    this.router.navigate([ goto ]);
    this.fabmenu.toggle();
  }
}