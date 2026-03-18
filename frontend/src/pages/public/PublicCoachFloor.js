import React, { useState } from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';
import './PublicCoachFloor.css';

const SATURDAY = [
  { name: 'Chloe Nicol',        club: 'apollo', event: 'DMT - 13-16 Female League 1',    panel: 7, flight: 1, no: 3,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Emily Swinton',      club: 'apollo', event: 'DMT - 13-16 Female League 1',    panel: 7, flight: 1, no: 7,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Harry Gregory',      club: 'apollo', event: 'DMT - 13-16 Male League 1',      panel: 7, flight: 1, no: 6,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Jaxson Morris',      club: 'apollo', event: 'DMT - 9-12 Male League 1',       panel: 8, flight: 1, no: 1,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Hector Shipley',     club: 'apollo', event: 'DMT - 13-16 Male League 2',      panel: 8, flight: 1, no: 3,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Sennen White',       club: 'apollo', event: 'DMT - 13-16 Male League 2',      panel: 8, flight: 1, no: 4,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Jonah Stevenson',    club: 'apollo', event: 'DMT - 13-16 Male League 2',      panel: 8, flight: 1, no: 6,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Luke Gregory',       club: 'apollo', event: 'DMT - 13-16 Male League 2',      panel: 8, flight: 1, no: 8,  warmUp: '10:00 – 10:20', compete: '10:20 – 10:55' },
  { name: 'Summer Mundin',      club: 'apollo', event: 'TRI - 13-14 Female League 3',    panel: 1, flight: 1, no: 7,  warmUp: '10:00 – 10:30', compete: '10:30 – 11:10' },
  { name: 'Emily Frakes',       club: 'apollo', event: 'TRI - 13-14 Female League 3',    panel: 1, flight: 1, no: 10, warmUp: '10:00 – 10:30', compete: '10:30 – 11:10' },
  { name: 'Amelia Mills',       club: 'apollo', event: 'TRI - 11-12 Female League 3',    panel: 2, flight: 1, no: 2,  warmUp: '10:00 – 10:30', compete: '10:30 – 11:20' },
  { name: 'Poppy Frith',        club: 'apollo', event: 'TRI - 11-12 Female League 3',    panel: 2, flight: 1, no: 4,  warmUp: '10:00 – 10:30', compete: '10:30 – 11:20' },
  { name: 'Esther Duncan',      club: 'apollo', event: 'TRI - 11-12 Female League 3',    panel: 2, flight: 1, no: 11, warmUp: '10:00 – 10:30', compete: '10:30 – 11:20' },
  { name: 'Madelaine Mason',    club: 'apollo', event: 'TRI - 9-10 Female League 3',     panel: 5, flight: 1, no: 1,  warmUp: '10:00 – 10:30', compete: '10:30 – 11:20' },
  { name: 'Jessica Mills',      club: 'apollo', event: 'TRI - 9-10 Female League 3',     panel: 5, flight: 1, no: 15, warmUp: '10:00 – 10:30', compete: '10:30 – 11:20' },
  { name: 'Abigail Beach',      club: 'tl',     event: 'TRI - 13-14 Female League 3',    panel: 1, flight: 2, no: 19, warmUp: '11:10 – 11:35', compete: '11:35 – 12:05' },
  { name: 'Charlotte Eldridge', club: 'apollo', event: 'TRI - 15 Girls League 3',        panel: 3, flight: 2, no: 14, warmUp: '11:15 – 11:40', compete: '11:40 – 12:10' },
  { name: 'Olivia Taylor',      club: 'apollo', event: 'TRI - 9-10 Female League 3',     panel: 5, flight: 2, no: 18, warmUp: '11:20 – 11:45', compete: '11:45 – 12:25' },
  { name: 'Tabitha Shipley',    club: 'apollo', event: 'TRI - 9-10 Female League 3',     panel: 5, flight: 2, no: 25, warmUp: '11:20 – 11:45', compete: '11:45 – 12:25' },
  { name: 'Evie-Grace Phillips',club: 'apollo', event: 'TRI - 17-18 Ladies League 3',    panel: 4, flight: 2, no: 19, warmUp: '11:25 – 11:55', compete: '11:55 – 12:35' },
  { name: 'Danny Stuart',       club: 'tl',     event: 'DMT - 17+ Male League 1',        panel: 8, flight: 2, no: 9,  warmUp: '11:35 – 11:55', compete: '11:55 – 12:30' },
  { name: 'Isabella Ross',      club: 'apollo', event: 'TRI - 13-14 Female League 3',    panel: 1, flight: 3, no: 27, warmUp: '12:05 – 12:30', compete: '12:30 – 13:00' },
  { name: 'Lucy Moffat',        club: 'apollo', event: 'TRI - 11-12 Female League 3',    panel: 2, flight: 3, no: 33, warmUp: '12:30 – 13:00', compete: '13:00 – 13:45' },
  { name: 'Jake Newsham',       club: 'apollo', event: 'TRI - 11-12 Boys League 3',      panel: 5, flight: 3, no: 1,  warmUp: '12:50 – 13:20', compete: '13:20 – 14:00' },
  { name: 'Etienne Dewhurst',   club: 'apollo', event: 'TRI - 9-12 Boys League 2',       panel: 4, flight: 3, no: 2,  warmUp: '13:00 – 13:30', compete: '13:30 – 14:10' },
  { name: 'David Latimer',      club: 'apollo', event: 'TRI - 9-12 Boys League 2',       panel: 4, flight: 3, no: 6,  warmUp: '13:00 – 13:30', compete: '13:30 – 14:10' },
  { name: 'Jayden Irvine-Duffy',club: 'apollo', event: 'TRI - 9-12 Boys League 2',       panel: 4, flight: 3, no: 9,  warmUp: '13:00 – 13:30', compete: '13:30 – 14:10' },
  { name: 'Chloe Nicol',        club: 'apollo', event: 'DMT - 9+ Female Super League',   panel: 7, flight: 3, no: 4,  warmUp: '13:10 – 13:40', compete: '13:40 – 14:20' },
  { name: 'Emily Swinton',      club: 'apollo', event: 'DMT - 9+ Female Super League',   panel: 7, flight: 3, no: 15, warmUp: '13:10 – 13:40', compete: '13:40 – 14:20' },
  { name: 'Leo Westbrook',      club: 'tl',     event: 'DMT - 9+ Male Super League',     panel: 8, flight: 3, no: 2,  warmUp: '13:10 – 13:40', compete: '13:40 – 14:20' },
  { name: 'Harry Gregory',      club: 'apollo', event: 'DMT - 9+ Male Super League',     panel: 8, flight: 3, no: 7,  warmUp: '13:10 – 13:40', compete: '13:40 – 14:20' },
  { name: 'Danny Stuart',       club: 'tl',     event: 'DMT - 9+ Male Super League',     panel: 8, flight: 3, no: 14, warmUp: '13:10 – 13:40', compete: '13:40 – 14:20' },
  { name: 'Ruby Doran',         club: 'apollo', event: 'TRI - 13-14 Female League 3',    panel: 1, flight: 4, no: 44, warmUp: '13:00 – 13:30', compete: '13:30 – 14:10' },
  { name: 'Alex Ford-Mirfin',   club: 'tl',     event: 'TRI - 19+ Male League 2',        panel: 3, flight: 4, no: 4,  warmUp: '13:45 – 14:15', compete: '14:15 – 14:50' },
  { name: 'Victoria Mckinley',  club: 'tl',     event: 'TRI - 19+ Female League 3',      panel: 2, flight: 4, no: 14, warmUp: '14:10 – 14:40', compete: '14:40 – 15:25' },
  { name: 'Ben Allen',          club: 'tl',     event: 'TRI - 13-14 Male League 3',      panel: 4, flight: 4, no: 12, warmUp: '14:40 – 15:10', compete: '15:10 – 15:55' },
  { name: 'Zach Wardle',        club: 'apollo', event: 'TRI - 13-14 Boys League 2',      panel: 3, flight: 5, no: 5,  warmUp: '15:20 – 15:45', compete: '15:45 – 16:15' },
  { name: 'Annabelle Burn',     club: 'apollo', event: 'DMT - 9-12 Female League 2',     panel: 7, flight: 5, no: 4,  warmUp: '15:25 – 15:35', compete: '15:35 – 15:55' },
  { name: 'Nancy Holland',      club: 'apollo', event: 'DMT - 9-12 Female League 2',     panel: 7, flight: 5, no: 5,  warmUp: '15:25 – 15:35', compete: '15:35 – 15:55' },
  { name: "Amelia O'connor",    club: 'apollo', event: 'DMT - 9-12 Female League 2',     panel: 7, flight: 5, no: 6,  warmUp: '15:25 – 15:35', compete: '15:35 – 15:55' },
  { name: 'Tristan Scott',      club: 'apollo', event: 'DMT - 9-12 Male League 2',       panel: 8, flight: 5, no: 5,  warmUp: '15:25 – 15:35', compete: '15:35 – 15:55' },
  { name: 'Jayden Irvine-Duffy',club: 'apollo', event: 'DMT - 9-12 Male League 2',       panel: 8, flight: 5, no: 6,  warmUp: '15:25 – 15:35', compete: '15:35 – 15:55' },
  { name: 'Grace Polak',        club: 'apollo', event: 'TRI - 19+ Ladies League 3',      panel: 2, flight: 5, no: 25, warmUp: '15:25 – 15:50', compete: '15:50 – 16:25' },
  { name: 'Abigail Blackett',   club: 'apollo', event: 'TRI - 16 Girls League 3',        panel: 5, flight: 5, no: 16, warmUp: '15:25 – 15:50', compete: '15:50 – 16:25' },
  { name: 'Chloe Thompson',     club: 'apollo', event: 'DMT - 17+ Female League 2',      panel: 7, flight: 6, no: 6,  warmUp: '16:25 – 16:35', compete: '16:35 – 16:55' },
  { name: 'Lily Thornton',      club: 'apollo', event: 'DMT - 13-16 Female League 2',    panel: 8, flight: 6, no: 5,  warmUp: '16:25 – 16:35', compete: '16:35 – 16:55' },
  { name: "Annabel O'connor",   club: 'apollo', event: 'DMT - 13-16 Female League 2',    panel: 8, flight: 7, no: 17, warmUp: '16:55 – 17:05', compete: '17:05 – 17:35' },
];

const SUNDAY = [
  { name: 'Millie Rooney',      club: 'tl',     event: 'DMT - 17+ Female League 3',          panel: 8, flight: 1, no: 10, warmUp: '09:00 – 09:20', compete: '09:20 – 09:50' },
  { name: 'Noah Sumner',        club: 'apollo', event: 'DT - 9-14 Mixed L1 C1',              panel: 5, flight: 1, no: 3,  warmUp: '09:00 – 09:25', compete: '09:25 – 10:10' },
  { name: 'Alice Cullen',       club: 'apollo', event: 'DT - 9+ Mixed Elite',                panel: 4, flight: 1, no: 6,  warmUp: '09:00 – 09:25', compete: '09:25 – 09:55' },
  { name: 'Esme Keal',          club: 'apollo', event: 'DT - 9+ Mixed Elite',                panel: 4, flight: 1, no: 8,  warmUp: '09:00 – 09:25', compete: '09:25 – 09:55' },
  { name: 'Chloe Nicol',        club: 'apollo', event: 'TRI - 15-16 Female League 1',        panel: 2, flight: 1, no: 1,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:15' },
  { name: 'Darcy Donnison',     club: 'apollo', event: 'TRI - 15-16 Female League 1',        panel: 2, flight: 1, no: 2,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:15' },
  { name: 'Samantha Cummins',   club: 'apollo', event: 'TRI - 15-16 Female League 1',        panel: 2, flight: 1, no: 4,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:15' },
  { name: 'Emily Swinton',      club: 'apollo', event: 'TRI - 15-16 Female League 1',        panel: 2, flight: 1, no: 8,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:15' },
  { name: 'Sennen White',       club: 'apollo', event: 'TRI - 13-14 Male League 1',          panel: 3, flight: 1, no: 2,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:20' },
  { name: 'Luke Gregory',       club: 'apollo', event: 'TRI - 13-14 Male League 1',          panel: 3, flight: 1, no: 3,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:20' },
  { name: 'Hector Shipley',     club: 'apollo', event: 'TRI - 13-14 Male League 1',          panel: 3, flight: 1, no: 6,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:20' },
  { name: 'Caelan Daly',        club: 'apollo', event: 'TRI - 13-14 Male League 1',          panel: 3, flight: 1, no: 8,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:20' },
  { name: 'Jonah Stevenson',    club: 'apollo', event: 'TRI - 13-14 Male League 1',          panel: 3, flight: 1, no: 9,  warmUp: '09:00 – 09:30', compete: '09:30 – 10:20' },
  { name: 'Olivia Justham',     club: 'apollo', event: 'TRI - 13-14 Female League 2',        panel: 1, flight: 1, no: 4,  warmUp: '09:00 – 09:35', compete: '09:35 – 10:30' },
  { name: 'Lily Thornton',      club: 'apollo', event: 'TRI - 15-16 Female League 2',        panel: 4, flight: 2, no: 8,  warmUp: '10:20 – 10:45', compete: '10:45 – 11:15' },
  { name: "Annabel O'connor",   club: 'apollo', event: 'TRI - 15-16 Female League 2',        panel: 4, flight: 2, no: 10, warmUp: '10:20 – 10:45', compete: '10:45 – 11:15' },
  { name: "Amelia O'connor",    club: 'apollo', event: 'DT - 9-14 Mixed L2 C1',              panel: 5, flight: 2, no: 3,  warmUp: '10:40 – 11:05', compete: '11:05 – 11:40' },
  { name: 'Holly Robinson',     club: 'apollo', event: 'TRI - 17-21 Female League 1',        panel: 2, flight: 2, no: 13, warmUp: '10:40 – 11:15', compete: '11:15 – 12:05' },
  { name: 'Harry Gregory',      club: 'apollo', event: 'TRI - 15-16 Male League 1',          panel: 3, flight: 2, no: 2,  warmUp: '10:45 – 11:10', compete: '11:10 – 11:40' },
  { name: 'Reece Dixon',        club: 'apollo', event: 'TRI - 15-16 Male League 1',          panel: 3, flight: 2, no: 4,  warmUp: '10:45 – 11:10', compete: '11:10 – 11:40' },
  { name: 'Ryley Allman',       club: 'apollo', event: 'TRI - 15-16 Male League 1',          panel: 3, flight: 2, no: 5,  warmUp: '10:45 – 11:10', compete: '11:10 – 11:40' },
  { name: 'Matthew Whitehead',  club: 'apollo', event: 'TRI - 15-16 Male League 1',          panel: 3, flight: 2, no: 7,  warmUp: '10:45 – 11:10', compete: '11:10 – 11:40' },
  { name: 'Daniel Pellegrina',  club: 'apollo', event: 'TRI - 15-16 Male League 1',          panel: 3, flight: 2, no: 9,  warmUp: '10:45 – 11:10', compete: '11:10 – 11:40' },
  { name: 'Emeli Duff',         club: 'apollo', event: 'TRI - 9-12 Female League 2',         panel: 1, flight: 2, no: 9,  warmUp: '10:55 – 11:25', compete: '11:25 – 12:05' },
  { name: 'Annabelle Burn',     club: 'apollo', event: 'TRI - 9-12 Female League 2',         panel: 1, flight: 2, no: 14, warmUp: '10:55 – 11:25', compete: '11:25 – 12:05' },
  { name: 'Lois Carpenter',     club: 'tl',     event: 'TRI - 19+ Female League 2',          panel: 5, flight: 3, no: 1,  warmUp: '12:05 – 12:35', compete: '12:35 – 13:10' },
  { name: 'Dhilan Daly',        club: 'apollo', event: 'TRI - 17-21 Male League 1',          panel: 3, flight: 3, no: 1,  warmUp: '12:05 – 12:45', compete: '12:45 – 13:35' },
  { name: 'Matthew Bell',       club: 'tl',     event: 'TRI - 17+ Male League 1 (Senior)',   panel: 3, flight: 3, no: 4,  warmUp: '12:05 – 12:45', compete: '12:45 – 13:35' },
  { name: 'Olivia Justham',     club: 'apollo', event: 'DMT - 13-14 Female League 3',        panel: 8, flight: 4, no: 3,  warmUp: '12:35 – 12:55', compete: '12:55 – 13:25' },
  { name: 'Abigail Beach',      club: 'tl',     event: 'DMT - 13-14 Female League 3',        panel: 8, flight: 4, no: 4,  warmUp: '12:35 – 12:55', compete: '12:55 – 13:25' },
  { name: 'Nancy Holland',      club: 'apollo', event: 'TRI - 9-12 Female League 1',         panel: 4, flight: 4, no: 3,  warmUp: '12:35 – 13:05', compete: '13:05 – 13:35' },
  { name: 'Isla L. Openshaw',   club: 'apollo', event: 'TRI - 9-12 Female League 1',         panel: 4, flight: 4, no: 4,  warmUp: '12:35 – 13:05', compete: '13:05 – 13:35' },
  { name: 'William Harvey',     club: 'apollo', event: 'TRI - 9-12 Male League 1',           panel: 4, flight: 4, no: 1,  warmUp: '12:35 – 13:05', compete: '13:05 – 13:35' },
  { name: 'Tate Dixon',         club: 'apollo', event: 'TRI - 9-12 Male League 1',           panel: 4, flight: 4, no: 3,  warmUp: '12:35 – 13:05', compete: '13:05 – 13:35' },
  { name: 'Tristan Scott',      club: 'apollo', event: 'TRI - 9-12 Male League 1',           panel: 4, flight: 4, no: 4,  warmUp: '12:35 – 13:05', compete: '13:05 – 13:35' },
  { name: 'Albi Lincoln',       club: 'apollo', event: 'TRI - 9-12 Male League 1',           panel: 4, flight: 4, no: 6,  warmUp: '12:35 – 13:05', compete: '13:05 – 13:35' },
  { name: 'Jaxson Morris',      club: 'apollo', event: 'TRI - 9-12 Male League 1',           panel: 4, flight: 4, no: 7,  warmUp: '12:35 – 13:05', compete: '13:05 – 13:35' },
  { name: 'Millie Rooney',      club: 'tl',     event: 'TRI - 19+ Female League 2',          panel: 5, flight: 4, no: 15, warmUp: '13:10 – 13:35', compete: '13:35 – 14:00' },
  { name: 'Heather Cannon',     club: 'apollo', event: 'TRI - 19+ Female League 2',          panel: 5, flight: 4, no: 18, warmUp: '13:10 – 13:35', compete: '13:35 – 14:00' },
  { name: 'Chloe Thompson',     club: 'apollo', event: 'TRI - 17-18 Female League 2',        panel: 1, flight: 4, no: 21, warmUp: '13:45 – 14:10', compete: '14:10 – 14:45' },
  { name: 'Madison Pape',       club: 'apollo', event: 'TRI - 17-18 Female League 2',        panel: 1, flight: 4, no: 23, warmUp: '13:45 – 14:10', compete: '14:10 – 14:45' },
  { name: 'Ryley Allman',       club: 'apollo', event: 'TRI - 9+ Male Super League',         panel: 3, flight: 4, no: 6,  warmUp: '14:05 – 14:40', compete: '14:40 – 15:30' },
  { name: 'Matthew Bell',       club: 'tl',     event: 'TRI - 9+ Male Super League',         panel: 3, flight: 4, no: 12, warmUp: '14:05 – 14:40', compete: '14:40 – 15:30' },
  { name: 'Jake Newsham',       club: 'apollo', event: 'DMT - 9-12 Male League 3',           panel: 8, flight: 6, no: 3,  warmUp: '14:50 – 15:10', compete: '15:10 – 15:45' },
  { name: 'Charlton & Holland', club: 'apollo', event: 'TRS - 12-15 Mixed Synchro',          panel: 5, flight: 6, no: 1,  warmUp: '16:00 – 16:30', compete: '16:30 – 17:00' },
  { name: 'Dixon & Gregory',    club: 'apollo', event: 'TRS - 12-15 Mixed Synchro',          panel: 5, flight: 6, no: 10, warmUp: '16:00 – 16:30', compete: '16:30 – 17:00' },
  { name: 'Harvey & Morris',    club: 'apollo', event: 'TRS - 12-15 Mixed Synchro',          panel: 5, flight: 6, no: 11, warmUp: '16:00 – 16:30', compete: '16:30 – 17:00' },
  { name: 'Keal & Pape',        club: 'apollo', event: 'TRS - 16-18 Mixed Synchro',          panel: 3, flight: 6, no: 2,  warmUp: '16:35 – 17:05', compete: '17:05 – 17:25' },
  { name: 'Allman & Pellegrina',club: 'apollo', event: 'TRS - 16-18 Mixed Synchro',          panel: 3, flight: 6, no: 4,  warmUp: '16:35 – 17:05', compete: '17:05 – 17:25' },
  { name: 'Nicol & Thompson',   club: 'apollo', event: 'TRS - 16-18 Mixed Synchro',          panel: 3, flight: 6, no: 8,  warmUp: '16:35 – 17:05', compete: '17:05 – 17:25' },
  { name: 'Carpenter & Rooney', club: 'tl',     event: 'TRS - 19+ Mixed Synchro',            panel: 2, flight: 6, no: 7,  warmUp: '16:35 – 17:05', compete: '17:05 – 17:35' },
  { name: 'Lincoln & Scott',    club: 'apollo', event: 'TRS - 12-15 Mixed Synchro',          panel: 5, flight: 7, no: 12, warmUp: '17:00 – 17:30', compete: '17:30 – 18:00' },
  { name: 'Burn & Wardle',      club: 'apollo', event: 'TRS - 12-15 Mixed Synchro',          panel: 5, flight: 7, no: 13, warmUp: '17:00 – 17:30', compete: '17:30 – 18:00' },
  { name: 'Cummins & Donnison', club: 'apollo', event: 'TRS - 12-15 Mixed Synchro',          panel: 5, flight: 7, no: 14, warmUp: '17:00 – 17:30', compete: '17:30 – 18:00' },
];

function disciplineTag(event) {
  if (event.startsWith('TRS')) return <span className="cf-tag cf-tag--trs">TRS</span>;
  if (event.startsWith('DMT')) return <span className="cf-tag cf-tag--dmt">DMT</span>;
  if (event.startsWith('DT'))  return <span className="cf-tag cf-tag--dt">DT</span>;
  return <span className="cf-tag cf-tag--tri">TRI</span>;
}

function ClubBadge({ club }) {
  return (
    <span className={`cf-club cf-club--${club}`}>
      {club === 'tl' ? 'TL' : 'Apollo'}
    </span>
  );
}

function Card({ r }) {
  const category = r.event.replace(/^(TRI|DMT|TRS|DT) - /, '');
  return (
    <div className="cf-card">
      <div className="cf-card-top">
        <div className="cf-card-name-row">
          <ClubBadge club={r.club} />
          <span className="cf-card-name">{r.name}</span>
          {disciplineTag(r.event)}
        </div>
        <span className="cf-card-category">{category}</span>
      </div>
      <div className="cf-card-meta">
        <span>Panel <strong>{r.panel}</strong></span>
        <span className="cf-dot">·</span>
        <span>Flight <strong>{r.flight}</strong></span>
        <span className="cf-dot">·</span>
        <span>No. <strong>{r.no}</strong></span>
      </div>
      <div className="cf-card-times">
        <div className="cf-time-block">
          <span className="cf-time-label">Warm-up</span>
          <span className="cf-time-value">{r.warmUp}</span>
        </div>
        <div className="cf-time-block cf-time-block--compete">
          <span className="cf-time-label">Compete</span>
          <span className="cf-time-value">{r.compete}</span>
        </div>
      </div>
    </div>
  );
}

function TableRow({ r }) {
  const category = r.event.replace(/^(TRI|DMT|TRS|DT) - /, '');
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ClubBadge club={r.club} />
          <span className="cf-name">{r.name}</span>
        </div>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {disciplineTag(r.event)}
          <span style={{ color: '#444' }}>{category}</span>
        </div>
      </td>
      <td className="cf-center">{r.panel}</td>
      <td className="cf-center">{r.flight}</td>
      <td className="cf-center">{r.no}</td>
      <td className="cf-nowrap">{r.warmUp}</td>
      <td className="cf-nowrap cf-compete-time">{r.compete}</td>
    </tr>
  );
}

function discipline(event) {
  if (event.startsWith('TRS')) return 'TRS';
  if (event.startsWith('DMT')) return 'DMT';
  if (event.startsWith('DT'))  return 'DT';
  return 'TRI';
}

export default function PublicCoachFloor() {
  const [day, setDay]       = useState('saturday');
  const [club, setClub]     = useState('all');
  const [disc, setDisc]     = useState('all');
  const [flight, setFlight] = useState('all');

  const allRows = day === 'saturday' ? SATURDAY : SUNDAY;
  const dateLabel = day === 'saturday' ? 'Saturday 21 March 2026' : 'Sunday 22 March 2026';

  const flights = [...new Set(allRows.map(r => r.flight))].sort((a, b) => a - b);

  const rows = allRows.filter(r => {
    if (club !== 'all' && r.club !== club) return false;
    if (disc !== 'all' && discipline(r.event) !== disc) return false;
    if (flight !== 'all' && r.flight !== Number(flight)) return false;
    return true;
  });

  const activeCount = (club !== 'all' ? 1 : 0) + (disc !== 'all' ? 1 : 0) + (flight !== 'all' ? 1 : 0);

  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-main">

        <section className="cf-hero">
          <div className="cf-hero-inner">
            <p className="cf-hero-label">Coach Floor Guide</p>
            <h1 className="cf-hero-title">Trampoline League 2026</h1>
          </div>
        </section>

        <section className="cf-section">
          <div className="cf-inner">

            <div className="cf-tabs" role="tablist">
              <button
                className={`cf-tab${day === 'saturday' ? ' cf-tab--active' : ''}`}
                onClick={() => { setDay('saturday'); setFlight('all'); }}
                role="tab"
                aria-selected={day === 'saturday'}
              >
                Saturday
              </button>
              <button
                className={`cf-tab${day === 'sunday' ? ' cf-tab--active' : ''}`}
                onClick={() => { setDay('sunday'); setFlight('all'); }}
                role="tab"
                aria-selected={day === 'sunday'}
              >
                Sunday
              </button>
            </div>

            <p className="cf-date">{dateLabel}</p>

            <div className="cf-filters">
              <div className="cf-filter-group">
                <label className="cf-filter-label">Club</label>
                <div className="cf-filter-pills">
                  {['all', 'tl', 'apollo'].map(v => (
                    <button key={v} className={`cf-pill${club === v ? ' cf-pill--active' : ''}`} onClick={() => setClub(v)}>
                      {v === 'all' ? 'All' : v === 'tl' ? 'TL' : 'Apollo'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cf-filter-group">
                <label className="cf-filter-label">Discipline</label>
                <div className="cf-filter-pills">
                  {['all', 'TRI', 'DMT', 'DT', 'TRS'].map(v => (
                    <button key={v} className={`cf-pill${disc === v ? ' cf-pill--active' : ''}`} onClick={() => setDisc(v)}>
                      {v === 'all' ? 'All' : v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cf-filter-group">
                <label className="cf-filter-label">Flight</label>
                <div className="cf-filter-pills">
                  <button className={`cf-pill${flight === 'all' ? ' cf-pill--active' : ''}`} onClick={() => setFlight('all')}>All</button>
                  {flights.map(f => (
                    <button key={f} className={`cf-pill${flight === String(f) ? ' cf-pill--active' : ''}`} onClick={() => setFlight(String(f))}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              {activeCount > 0 && (
                <button className="cf-clear" onClick={() => { setClub('all'); setDisc('all'); setFlight('all'); }}>
                  Clear filters
                </button>
              )}
            </div>

            {rows.length === 0 && (
              <p className="cf-empty">No entries match the selected filters.</p>
            )}

            <div className="cf-cards">
              {rows.map((r, i) => <Card key={i} r={r} />)}
            </div>

            <div className="cf-table-wrap">
              <table className="cf-table">
                <thead>
                  <tr>
                    <th>Competitor</th>
                    <th>Event</th>
                    <th>Panel</th>
                    <th>Flight</th>
                    <th>No.</th>
                    <th>Warm-Up</th>
                    <th>Compete</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => <TableRow key={i} r={r} />)}
                </tbody>
              </table>
            </div>

          </div>
        </section>

      </main>
      <PublicFooter />
    </div>
  );
}
