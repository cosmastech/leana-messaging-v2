DROP TABLE IF EXISTS subscribers;
CREATE TABLE `subscribers` (
  `id` int primary key,
  `contact` varchar(45) UNIQUE,
  `is_admin` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1'
);
