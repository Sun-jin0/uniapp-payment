import mysql.connector
from mysql.connector import errorcode
import traceback

# --- Database Configuration ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',
    'database': 'ojld'
}

# --- Table Definitions ---
TABLES = {}
TABLES['Subjects'] = (
    "CREATE TABLE IF NOT EXISTS `Subjects` ("
    "  `SubjectID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `SubjectName` VARCHAR(100) NOT NULL UNIQUE"
    ") ENGINE=InnoDB")

TABLES['Books'] = (
    "CREATE TABLE IF NOT EXISTS `Books` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `BookID` INT NOT NULL UNIQUE,"
    "  `BookTitle` VARCHAR(255) NOT NULL,"
    "  `SubjectID` INT NOT NULL,"
    "  `SourceJsonFileName` VARCHAR(255) NULL,"
    "  `Description` TEXT NULL,"
    "  `CreationTimestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    "  `VersionInfo` VARCHAR(100) NULL,"
    "  `LearnerCount` INT NULL,"
    "  `StyleType` VARCHAR(20) NULL,"
    "  `IsNew` BOOLEAN NULL DEFAULT FALSE,"
    "  `OverlayBannerText` VARCHAR(100) NULL,"
    "  `ThumbnailText` VARCHAR(100) NULL,"
    "  FOREIGN KEY (`SubjectID`) REFERENCES `Subjects`(`SubjectID`) ON DELETE RESTRICT ON UPDATE CASCADE,"
    "  INDEX `idx_books_bookid_meaningful` (`BookID`)"
    ") ENGINE=InnoDB")

TABLES['Questions'] = (
    "CREATE TABLE IF NOT EXISTS `Questions` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `QuestionID` INT NOT NULL UNIQUE COMMENT 'Unique Global Question Identifier from external source.'," # This is the one your data import should use with ON DUPLICATE KEY UPDATE
    "  `QuestionText` TEXT NULL,"
    "  `OriginalAnswerText` TEXT NULL,"
    "  `LegacyOriginalBookID` INT NULL,"
    "  `LegacyOriginalQuestionSort` VARCHAR(50) NULL,"
    "  `LinksCount` VARCHAR(255) NULL,"
    "  `LinkNames` TEXT NULL,"
    "  INDEX `idx_questions_questionid_meaningful` (`QuestionID`)"
    ") ENGINE=InnoDB")

# Corrected part from previous answer's schema for BookQuestions:
TABLES['BookQuestions'] = (
    "CREATE TABLE IF NOT EXISTS `BookQuestions` ("
    "  `EntryID` INT NOT NULL PRIMARY KEY COMMENT 'Unique ID for this book-question entry (from JSON ID field)',"
    "  `BookID` INT NOT NULL COMMENT 'Contextual Book ID from JSON',"
    "  `QuestionID` INT NOT NULL COMMENT 'Contextual Question ID from JSON',"
    "  `QuestionPage` VARCHAR(20) NULL,"
    "  `QuestionSort` VARCHAR(10) NULL COMMENT 'Specific sort on page/chapter from JSON (can be repeated)',"
    "  `Sort` INT NULL COMMENT 'Overall sort order/number within its context in this book (from JSON Sort - can now be repeated for different EntryIDs)',"
    "  `ChapterName` VARCHAR(255) NULL,"
    "  `BookChapter` VARCHAR(255) NULL,"
    "  `ChapterSort` INT NULL,"
    "  `QuestionImg` VARCHAR(512) NULL,"
    "  INDEX `idx_bq_bookid` (`BookID`),"
    "  INDEX `idx_bq_questionid` (`QuestionID`),"
    "  INDEX `idx_bq_bookid_sort` (`BookID`, `Sort`)" # This is a non-unique index, which is OK.
    ") ENGINE=InnoDB COMMENT='Links Books to Questions with context. Uniqueness by EntryID (JSON ID). Sort can be repeated.'")

TABLES['KnowledgePoints'] = (
    "CREATE TABLE IF NOT EXISTS `KnowledgePoints` ("
    "  `KnowledgePointID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `KPCode` VARCHAR(50) UNIQUE COMMENT 'If this is the natural key, data import should use ON DUPLICATE KEY UPDATE on this',"
    "  `KPTitle` VARCHAR(255) NOT NULL,"
    "  `KPContent` TEXT,"
    "  `KPType` VARCHAR(50),"
    "  `KPBusType` VARCHAR(50),"
    "  `KPPCode` VARCHAR(50),"
    "  `KPNotes` TEXT,"
    "  `KPOutlineType` VARCHAR(50),"
    "  `KPDifficultyType` VARCHAR(50)"
    ") ENGINE= InnoDB")

TABLES['QuestionDetails'] = (
    "CREATE TABLE IF NOT EXISTS `QuestionDetails` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `QuestionID` INT NOT NULL,"
    "  `BusType` VARCHAR(50) NOT NULL,"
    "  `Context` TEXT,"
    "  `Give` INT,"
    "  `Notes` TEXT,"
    "  `JsonData` TEXT,"
    "  `Title` VARCHAR(255),"
    "  `IsProductBook` BOOLEAN DEFAULT 0,"
    "  `LinkedKnowledgePointID` INT NULL,"
    "  `SourceDetailID` INT NULL COMMENT 'Original ID from JSON second_request item, for reference',"
    "  FOREIGN KEY (`LinkedKnowledgePointID`) REFERENCES `KnowledgePoints`(`KnowledgePointID`) ON DELETE SET NULL ON UPDATE CASCADE,"
    # Add a UNIQUE key to define what makes a detail entry a duplicate
    # Example: A question can only have one '答案' (answer) identified by a specific SourceDetailID (if it's unique per detail type)
    "  UNIQUE KEY `UQ_QuestionDetailItem` (`QuestionID`, `BusType`, `SourceDetailID`) COMMENT 'Assumes SourceDetailID is unique within a QuestionID & BusType context',"
    "  INDEX `idx_qdetails_questionid` (`QuestionID`)"
    ") ENGINE=InnoDB")

TABLES['RelatedQuestions'] = (
    "CREATE TABLE IF NOT EXISTS `RelatedQuestions` ("
    "  `ID` INT AUTO_INCREMENT PRIMARY KEY,"
    "  `SourceQuestionID` INT NOT NULL,"
    "  `RelatedQuestionOriginalID` VARCHAR(50) NOT NULL COMMENT 'Identifier of the related question (e.g. another QuestionID)',"
    "  `RelatedQuestionText` TEXT NULL,"
    "  `LinkNames` TEXT NULL,"
    "  `FocalLink` INT NULL,"
    "  `QuestionPage` VARCHAR(20) NULL,"
    "  `SourceThirdRequestID` INT NULL COMMENT 'Original ID from JSON third_request item, for reference',"
    # Add a UNIQUE key to define what makes a related question entry a duplicate
    "  UNIQUE KEY `UQ_RelatedQuestionPair` (`SourceQuestionID`, `RelatedQuestionOriginalID`) COMMENT 'Prevents adding the same related question link twice for a source question',"
    "  INDEX `idx_relatedq_sourceqid` (`SourceQuestionID`)"
    ") ENGINE=InnoDB")

TABLE_PROCESSING_ORDER = [
    'RelatedQuestions', 'BookQuestions', 'QuestionDetails', 'KnowledgePoints', 'Questions', 'Books', 'Subjects'
]

def create_database_if_not_exists(cursor, db_name):
    try:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` DEFAULT CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
        print(f"Database '{db_name}' ensured.")
    except mysql.connector.Error as err:
        print(f"Failed creating database '{db_name}': {err}"); exit(1)

def drop_all_existing_tables(cursor, cnx):
    print("\n--- Dropping All Existing Tables ---")
    try:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
        for table_name in TABLE_PROCESSING_ORDER:
            print(f"Dropping table `{table_name}`... ", end=''); cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`"); print("OK")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
        cnx.commit(); print("Finished dropping tables.")
    except mysql.connector.Error as err:
        print(f"Error dropping tables: {err}");
        try: cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
        except: pass
        raise

def create_all_tables_and_indexes(cursor, cnx):
    creation_order = TABLE_PROCESSING_ORDER[::-1]
    print("\n--- Creating Tables ---")
    for table_name in creation_order:
        if table_name not in TABLES: print(f"Warning: Def for '{table_name}' not found. Skipping."); continue
        try:
            print(f"Creating table `{table_name}`... ", end=''); cursor.execute(TABLES[table_name]); print("OK")
            cnx.commit()
        except mysql.connector.Error as err: print(f"Failed creating `{table_name}`: {err.msg}"); raise

    print("\n--- Pre-populating Subjects Table ---")
    for subject_name in ["数一", "数二", "数三"]:
        try: cursor.execute("INSERT IGNORE INTO Subjects (SubjectName) VALUES (%s)", (subject_name,))
        except mysql.connector.Error as err: print(f"Error pre-populating '{subject_name}': {err}")
    cnx.commit(); print("Subjects table pre-populated.")

def main_schema_reset_and_creation():
    cnx_server = None; cursor_server = None; cnx_db = None; cursor_db = None
    confirm = input(f"DROP ALL TABLES in '{DB_CONFIG['database']}' & recreate schema (with UNIQUE keys for deduplication)? Type 'YES': ")
    if confirm.upper() != 'YES': print("Cancelled."); return

    try:
        print("Connecting to MySQL server...");
        cnx_server = mysql.connector.connect(host=DB_CONFIG['host'], user=DB_CONFIG['user'], password=DB_CONFIG['password'])
        cursor_server = cnx_server.cursor(); create_database_if_not_exists(cursor_server, DB_CONFIG['database'])
        cursor_server.close(); cnx_server.close(); print("Server connection closed.")

        print(f"\nConnecting to database '{DB_CONFIG['database']}'...");
        cnx_db = mysql.connector.connect(**DB_CONFIG); cursor_db = cnx_db.cursor()
        print("Connected to database.")

        drop_all_existing_tables(cursor_db, cnx_db)
        create_all_tables_and_indexes(cursor_db, cnx_db)

        print("\nSchema reset & creation complete. Tables have UNIQUE keys for deduplication during data import.")
        print("Your data import scripts should use INSERT IGNORE or INSERT...ON DUPLICATE KEY UPDATE.")

    except mysql.connector.Error as err: print(f"MySQL Error: {err}"); traceback.print_exc()
    except Exception as e: print(f"Unexpected error: {e}"); traceback.print_exc()
    finally:
        if cursor_db: cursor_db.close()
        if cnx_db and cnx_db.is_connected(): cnx_db.close(); print(f"MySQL connection to '{DB_CONFIG['database']}' closed.")

if __name__ == '__main__':
    main_schema_reset_and_creation()